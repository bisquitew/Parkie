import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { API_CONFIG } from '../config/api';

// SDK 55 uses expo-audio instead of expo-av
let AudioModule = null;
const getAudioModule = async () => {
  if (!AudioModule) {
    AudioModule = await import('expo-audio');
  }
  return AudioModule;
};

export default function VoiceSearchBar({ onSearchComplete }) {
  const [recorder, setRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  async function startRecording() {
    try {
      const { requestRecordingPermissionsAsync, RecordingPresets, AudioModule: NativeModule, setAudioModeAsync } = await getAudioModule();
      
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return;

      // Enable recording mode globally for the app
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Create new recorder instance
      const newRecorder = new NativeModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await newRecorder.prepareToRecordAsync();
      
      newRecorder.record();
      setRecorder(newRecorder);
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (!recorder) return;

    setIsRecording(false);
    setIsUploading(true);
    try {
      recorder.stop();
      const uri = recorder.uri;
      console.log('Recording stopped at', uri);

      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/search/voice`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      console.log('Voice search result:', data);

      if (data.location && onSearchComplete) {
        onSearchComplete({
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          name: data.location.name
        });
      }
    } catch (err) {
      console.error('Failed to stop/upload recording', err);
    } finally {
      setRecorder(null);
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          style={[
            styles.button,
            isRecording && styles.recordingButton
          ]}
        >
          {isUploading ? (
            <ActivityIndicator color={colors.secondary} size="small" />
          ) : (
            <Ionicons 
              name={isRecording ? "stop" : "mic-outline"} 
              size={24} 
              color={colors.secondary} 
            />
          )}
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.label}>{isRecording ? "STOP" : "VOICE"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  button: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 4,
  },
  recordingButton: {
    backgroundColor: 'rgba(141, 35, 190, 0.2)',
    borderColor: colors.primary,
  },
  label: {
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});



