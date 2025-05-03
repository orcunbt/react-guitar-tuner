import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Typography, Select, MenuItem, Box, Paper, Grid, Button, useTheme } from '@mui/material';
import Footer from './Footer';

// --- Constants and Note Data ---
const A4 = 440;
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const allNoteFrequencies = {};
for (let octave = 0; octave < 9; octave++) {
  for (let n = 0; n < 12; n++) {
    const noteIndex = n + (octave * 12);
    const semitones = noteIndex - 57;
    const freq = A4 * Math.pow(2, semitones / 12);
    const noteName = noteStrings[n] + octave;
    if (freq > 50 && freq < 2000) {
       allNoteFrequencies[noteName] = freq;
    }
  }
}
const tunings = {
  "Standard": [ { note: "E2", label: "Low E", frequency: 82.41 }, { note: "A2", label: "A", frequency: 110.00 }, { note: "D3", label: "D", frequency: 146.83 }, { note: "G3", label: "G", frequency: 196.00 }, { note: "B3", label: "B", frequency: 246.94 }, { note: "E4", label: "High E", frequency: 329.63 } ],
  "Drop D": [ { note: "D2", label: "Low D", frequency: 73.42 }, { note: "A2", label: "A", frequency: 110.00 }, { note: "D3", label: "D", frequency: 146.83 }, { note: "G3", label: "G", frequency: 196.00 }, { note: "B3", label: "B", frequency: 246.94 }, { note: "E4", label: "High E", frequency: 329.63 } ],
  "Half-Step Down": [ { note: "Eb2", label: "Low Eb", frequency: 77.78 }, { note: "Ab2", label: "Ab", frequency: 103.83 }, { note: "Db3", label: "Db", frequency: 138.59 }, { note: "Gb3", label: "Gb", frequency: 185.00 }, { note: "Bb3", label: "Bb", frequency: 233.08 }, { note: "Eb4", label: "High Eb", frequency: 311.13 } ],
};
// --- End Constants ---


// --- TunerGauge Component ---
const GAUGE_RANGE_CENTS = 50; const GAUGE_ARC_ANGLE = 160; const NEEDLE_LENGTH = 45; const GAUGE_WIDTH = 200; const GAUGE_HEIGHT = 100; const CENTER_X = GAUGE_WIDTH / 2; const CENTER_Y = GAUGE_HEIGHT * 0.9;
const TunerGauge = ({ centsOff }) => {
  const theme = useTheme(); let angle = 0;
  if (centsOff !== null && !isNaN(centsOff)) { const clampedCents = Math.max(-GAUGE_RANGE_CENTS, Math.min(GAUGE_RANGE_CENTS, centsOff)); angle = (clampedCents / GAUGE_RANGE_CENTS) * (GAUGE_ARC_ANGLE / 2); }
  let needleColor = theme.palette.text.secondary; const absCents = Math.abs(centsOff ?? 100);
  if (centsOff !== null && !isNaN(centsOff)) { if (absCents <= 5) needleColor = theme.palette.success.main; else if (absCents <= 15) needleColor = theme.palette.warning.main; else needleColor = theme.palette.error.main; }
  const needleStyle = { transform: `rotate(${angle}deg)`, transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, transition: 'transform 0.2s ease-out', stroke: needleColor, strokeWidth: 2.5, strokeLinecap: 'round' };
  const describeArc = (x, y, radius, startAngle, endAngle) => { const start = polarToCartesian(x, y, radius, endAngle); const end = polarToCartesian(x, y, radius, startAngle); const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"; return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" "); }; const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => { const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0; return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) }; }; const arcRadius = GAUGE_WIDTH * 0.4; const arcStartY = CENTER_Y - 5;
  return ( <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: GAUGE_HEIGHT + 10, mb: 1 }}> <svg width={GAUGE_WIDTH} height={GAUGE_HEIGHT} viewBox={`0 0 ${GAUGE_WIDTH} ${GAUGE_HEIGHT}`}> <path d={describeArc(CENTER_X, arcStartY, arcRadius, -GAUGE_ARC_ANGLE / 2, GAUGE_ARC_ANGLE / 2)} fill="none" stroke={theme.palette.grey[300]} strokeWidth="5" strokeLinecap="round"/> <path d={describeArc(CENTER_X, arcStartY, arcRadius, -5, 5)} fill="none" stroke={theme.palette.success.light} strokeWidth="7" strokeLinecap="round"/> <line x1={CENTER_X} y1={CENTER_Y} x2={CENTER_X} y2={CENTER_Y - NEEDLE_LENGTH} style={needleStyle}/> <circle cx={CENTER_X} cy={CENTER_Y} r="3" fill={theme.palette.grey[600]} /> </svg> </Box> );
};
// --- End TunerGauge Component ---


// --- GuitarTuner Component ---
const GuitarTuner = () => {
  // State
  const [selectedTuning, setSelectedTuning] = useState("Standard");
  const [detectedFrequency, setDetectedFrequency] = useState(null);
  const [closestNoteName, setClosestNoteName] = useState("");
  const [centsOff, setCentsOff] = useState(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [closestTargetStringIndex, setClosestTargetStringIndex] = useState(-1);

  // Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafIdRef = useRef(null);
  const bufferLengthRef = useRef(null); 
  // sourceRef and streamRef are used in start/stop functions
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  const theme = useTheme();

  // --- Initialize AudioContext useEffect ---
  useEffect(() => {
    // Add Press Start 2P font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new AudioContext();
            console.log("AudioContext created, initial state:", audioContextRef.current.state);
        } catch (e) {
            console.error("Error creating AudioContext:", e);
            setErrorMessage("Could not initialize audio. Your browser might not support the Web Audio API.");
        }
    }
    return () => {
        console.log("GuitarTuner unmounting. Full cleanup.");
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch(e){} }
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        rafIdRef.current = null; sourceRef.current = null; streamRef.current = null; analyserRef.current = null;
    };
  }, []);

  // --- Autocorrelation Function ---
  const autoCorrelate = useCallback((buffer, sampleRate) => {
    const SIZE = buffer.length; let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / SIZE); if (rms < 0.01) return -1;
    const minFreq = 60; const maxFreq = 1500;
    const minOffset = Math.floor(sampleRate / maxFreq); const maxOffset = Math.floor(sampleRate / minFreq);
    const effectiveMaxOffset = Math.min(maxOffset, Math.floor(SIZE / 2) - 1);
    if (minOffset >= effectiveMaxOffset) return -1;
    const correlations = new Float32Array(effectiveMaxOffset + 1); let bestOffset = -1; let maxCorrelation = -Infinity;
    for (let offset = minOffset; offset <= effectiveMaxOffset; offset++) {
      let correlation = 0; for (let i = 0; i < effectiveMaxOffset; i++) { if (i + offset >= SIZE) break; correlation += buffer[i] * buffer[i + offset]; }
      correlations[offset] = correlation; if (correlation > maxCorrelation) { maxCorrelation = correlation; bestOffset = offset; }
    }
    if (bestOffset === -1 || maxCorrelation <= 0) return -1;
    let interpolatedOffset = bestOffset;
    if (bestOffset > minOffset && bestOffset < effectiveMaxOffset) { const y0 = correlations[bestOffset - 1]; const y1 = correlations[bestOffset]; const y2 = correlations[bestOffset + 1]; const d = (y2 - y0) / 2; const e = y1 - (y0 + y2) / 2; if (e !== 0) interpolatedOffset += d / (-2 * e); }
    if (interpolatedOffset <= 0) return -1; const detectedFreq = sampleRate / interpolatedOffset;
    if (detectedFreq < minFreq || detectedFreq > maxFreq) return -1; return detectedFreq;
  }, []);

  // --- Frequency to Note/Cents Calculation ---
  const frequencyToNoteAndCents = useCallback((freq) => { // Wrap in useCallback
    let minDifference = Infinity; let closestNote = ""; let closestNoteFreq = 0;
    for (const note in allNoteFrequencies) { const freqDiff = Math.abs(Math.log2(freq / allNoteFrequencies[note])); if (freqDiff < minDifference) { minDifference = freqDiff; closestNote = note; closestNoteFreq = allNoteFrequencies[note]; } }
    if (!closestNote || closestNoteFreq <= 0) return { noteName: "?", cents: null };
    const cents = 1200 * Math.log2(freq / closestNoteFreq); return { noteName: closestNote, cents: Math.round(cents) };
  }, []); // No dependencies as it relies on constants

  // --- Pitch Update Loop ---
  const updatePitch = useCallback(() => {
    const currentContextState = audioContextRef.current?.state;
    if (!analyserRef.current || !dataArrayRef.current || currentContextState !== 'running') {
      rafIdRef.current = null;
      return;
    }
    let fundamentalFrequency = -1;
    try {
      analyserRef.current.getFloatTimeDomainData(dataArrayRef.current);
      fundamentalFrequency = autoCorrelate(dataArrayRef.current, audioContextRef.current.sampleRate);
    } catch (error) {
      setErrorMessage("Error during analysis.");
      rafIdRef.current = null;
      return;
    }
  
    if (fundamentalFrequency !== -1 && fundamentalFrequency > 0) {
      setDetectedFrequency(fundamentalFrequency.toFixed(2));
  
      // 1) Get the actual note name from the universal dictionary.
      const { noteName: actualNoteName } = frequencyToNoteAndCents(fundamentalFrequency);
      setClosestNoteName(actualNoteName);
  
      // 2) Use the selected tuning to calculate the cents offset.
      const currentTuningStrings = tunings[selectedTuning];
      if (currentTuningStrings) {
        let minDist = Infinity;
        let closestIndex = -1;
        currentTuningStrings.forEach((stringInfo, index) => {
          const dist = Math.abs(fundamentalFrequency - stringInfo.frequency);
          if (dist < minDist) {
            minDist = dist;
            closestIndex = index;
          }
        });
        setClosestTargetStringIndex(closestIndex);
  
        if (closestIndex !== -1) {
          const targetFrequency = currentTuningStrings[closestIndex].frequency;
          const centsOffTuning = Math.round(1200 * Math.log2(fundamentalFrequency / targetFrequency));
          setCentsOff(centsOffTuning);
        } else {
          setCentsOff(null);
        }
      } else {
        // Fallback: if tuning is not found, use the universal cents value.
        const { cents } = frequencyToNoteAndCents(fundamentalFrequency);
        setCentsOff(cents);
        setClosestTargetStringIndex(-1);
      }
    } else {
      if (audioStarted) {
        setDetectedFrequency(null);
        setClosestNoteName("");
        setCentsOff(null);
        setClosestTargetStringIndex(-1);
      }
    }
  
    if (audioStarted && audioContextRef.current?.state === 'running') {
      rafIdRef.current = requestAnimationFrame(updatePitch);
    } else {
      rafIdRef.current = null;
    }
  }, [audioStarted, autoCorrelate, selectedTuning, frequencyToNoteAndCents]);
  
  

  // --- Effect to Start/Stop the Loop ---
  useEffect(() => {
    if (audioStarted && audioContextRef.current?.state === 'running') {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updatePitch);
    } else {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [audioStarted, updatePitch]); 

  // --- Start Audio Function ---
  const startAudio = useCallback(async () => { 
    setErrorMessage(""); if (!audioContextRef.current) { setErrorMessage("Audio system not ready."); return; }
    if (audioContextRef.current.state === "suspended") { try { await audioContextRef.current.resume(); } catch (err) { setErrorMessage("Failed to start audio. Click again/check permissions."); setAudioStarted(false); return; } }
    if (audioContextRef.current.state !== 'running') { setErrorMessage(`Audio system error (state: ${audioContextRef.current.state}).`); setAudioStarted(false); return; }
    if (audioStarted || sourceRef.current) return;
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } }); streamRef.current = stream; stream.getTracks().forEach(track => { track.onended = () => { setErrorMessage("Microphone stream ended."); stopAudioProcessing(); }; });
      if (!analyserRef.current) { analyserRef.current = audioContextRef.current.createAnalyser(); analyserRef.current.fftSize = 2048; bufferLengthRef.current = analyserRef.current.fftSize; dataArrayRef.current = new Float32Array(bufferLengthRef.current); }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream); sourceRef.current.connect(analyserRef.current); setAudioStarted(true);
    } catch (err) { if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') setErrorMessage("Microphone access denied."); else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') setErrorMessage("No microphone found."); else setErrorMessage(`Mic error: ${err.message}`); setAudioStarted(false); if (sourceRef.current) sourceRef.current.disconnect(); if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); sourceRef.current = null; streamRef.current = null; }
  }, [audioStarted]); 

  // --- Stop Audio Function ---
  const stopAudioProcessing = useCallback(() => { 
    console.log("stopAudioProcessing called.");
    setAudioStarted(false);
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch (e) { console.error("Err disconnecting src:", e); } sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    setDetectedFrequency(null); setClosestNoteName(""); setCentsOff(null); setClosestTargetStringIndex(-1);
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
  }, []); // No external dependencies

  // --- Format Cents Helper ---
  const formatCents = useCallback((cents) => { 
    if (cents === null || isNaN(cents)) return ""; if (cents === 0) return "(Perfect)"; return `(${cents > 0 ? '+' : ''}${cents}c)`;
  }, []); 

  // --- JSX Rendering ---
  return (
    <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}
  >
    <Container maxWidth="md"         sx={{
          mt: 4,
          flexGrow: 1,
          fontFamily: "'Press Start 2P', cursive",
        }}>

      <Typography variant="h4" align="center" gutterBottom fontWeight="bold" sx={{ fontFamily: "'Press Start 2P', cursive" }}> React Guitar Tuner </Typography>

      {errorMessage && <Typography color="error" align="center" sx={{ mb: 2, fontWeight: 'bold', fontFamily: "'Press Start 2P', cursive" }}> ⚠️ {errorMessage} </Typography>}

      {!audioStarted ? (
        <Box display="flex" justifyContent="center" marginBottom="2rem">
           <Button variant="contained" color="primary" onClick={startAudio} size="large" sx={{ fontFamily: "'Press Start 2P', cursive" }} disabled={!!errorMessage && !errorMessage.includes("access") && !errorMessage.includes("click again") && !errorMessage.includes("error (state:")}> Start Tuner </Button>
        </Box>
      ) : (
        <>
          {/* Tuning Selector */}
          <Box display="flex" justifyContent="center" alignItems="center" marginBottom="2rem">
            <Typography variant="body1" sx={{ mr: 1.5, fontFamily: "'Press Start 2P', cursive" }}>Tuning:</Typography>
            <Select value={selectedTuning} onChange={(e) => { setSelectedTuning(e.target.value); setClosestTargetStringIndex(-1); }} variant="outlined" size="small" sx={{ fontFamily: "'Press Start 2P', cursive" }}>
              {Object.keys(tunings).map((tuning) => (<MenuItem key={tuning} value={tuning} sx={{ fontFamily: "'Press Start 2P', cursive" }}> {tuning} </MenuItem>))}
            </Select>
          </Box>

          {/* Main Display */}
          <Paper elevation={3} sx={{ padding: '1rem 2rem 2rem 2rem', textAlign: 'center', borderRadius: '8px' }}>
             <Box minHeight="180px" display="flex" flexDirection="column" alignItems="center" justifyContent="center" marginBottom="1rem" >
                <TunerGauge centsOff={centsOff} />
                <Typography variant="h4" fontWeight="bold" noWrap sx={{ minHeight: '1.2em', fontFamily: "'Press Start 2P', cursive" }}> {closestNoteName || (audioStarted ? "--" : "Stopped")} </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ minHeight: '1.2em', fontFamily: "'Press Start 2P', cursive" }}> {detectedFrequency ? `${detectedFrequency} Hz` : (audioStarted ? "Listening..." : "")} </Typography>
                <Typography variant="body1" fontWeight="bold" sx={{ minHeight: '1.2em', fontFamily: "'Press Start 2P', cursive" }}> {closestNoteName ? formatCents(centsOff) : ""} </Typography>
             </Box>

            {/* Target Notes Display */}
            <Typography variant="h6" gutterBottom sx={{ fontFamily: "'Press Start 2P', cursive" }}>Target Notes ({selectedTuning})</Typography>
            <Grid container spacing={1} justifyContent="center" style={{ marginTop: '1rem' }}>
              {tunings[selectedTuning]?.map((stringInfo, index) => {
                  const isClosest = index === closestTargetStringIndex;
                  const borderStyle = isClosest
                      ? { border: `3px solid ${theme.palette.primary.main}`, transform: 'scale(1.03)' }
                      : { border: `1px solid ${theme.palette.grey[300]}` };

                  return (
                      <Grid key={stringInfo.label} xs={4} sm={2}>
                          <Paper variant="outlined" sx={{ padding: '0.5rem', textAlign: 'center', height: '100%', transition: 'border 0.2s ease-out, transform 0.2s ease-out', ...borderStyle }}>
                              <Typography variant="h6" component="div" sx={{ fontFamily: "'Press Start 2P', cursive" }}>{stringInfo.note.replace(/\d/, '')}</Typography>
                              <Typography variant="caption" display="block" sx={{ fontFamily: "'Press Start 2P', cursive" }}>{stringInfo.label}</Typography>
                              <Typography variant="caption" display="block" color="textSecondary" sx={{ fontFamily: "'Press Start 2P', cursive" }}>{stringInfo.frequency} Hz</Typography>
                          </Paper>
                      </Grid>
                  );
                })}
            </Grid>
          </Paper>

          {/* Stop Button */}
          <Box display="flex" justifyContent="center" marginTop="2rem">
            <Button variant="outlined" color="secondary" onClick={stopAudioProcessing} sx={{ fontFamily: "'Press Start 2P', cursive" }}> Stop Tuner </Button>
          </Box>
        </>
      )}
     
    </Container>
    <Footer sx={{ fontFamily: "'Press Start 2P', cursive" }}></Footer>
 
    </Box>
    
  );
};

export default GuitarTuner; 