import { useEffect, useRef, useState, useCallback } from 'react';

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  onError?: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
  prefix?: string;
  suffix?: string;
}

export interface BarcodeScannerState {
  lastScannedCode: string | null;
  lastScannedAt: Date | null;
  scanCount: number;
  isListening: boolean;
}

/**
 * Hook to capture high-speed keyboard input from USB/Bluetooth/Wireless barcode scanners in POS mode.
 * Automatically distinguishes barcode gun bursts from manual keyboard typing.
 */
export const useBarcodeScanner = ({
  onScan,
  onError,
  minChars = 2,
  maxIntervalMs = 70,
  enabled = true,
  suffix = 'Enter',
}: BarcodeScannerOptions): BarcodeScannerState => {
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const isScanningRef = useRef<boolean>(false);
  const timeoutRef = useRef<any>(null);

  const processBarcode = useCallback(
    (rawCode: string) => {
      const cleanCode = rawCode.trim();
      if (cleanCode.length >= minChars) {
        setLastScannedCode(cleanCode);
        setLastScannedAt(new Date());
        setScanCount((prev) => prev + 1);
        onScan(cleanCode);
      } else if (cleanCode.length > 0 && onError) {
        onError(cleanCode);
      }
    },
    [minChars, onScan, onError]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentTime = performance.now();
      const timeSinceLastKey = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Ignore modifier keys alone
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(event.key)) {
        return;
      }

      // Check if this is the terminator key (usually Enter from barcode scanner)
      if (event.key === suffix) {
        const bufferedText = bufferRef.current;
        
        // If we accumulated characters in a rapid burst OR have buffered barcode
        if (bufferedText.length >= minChars) {
          event.preventDefault();
          event.stopPropagation();
          processBarcode(bufferedText);
        }

        // Reset buffer
        bufferRef.current = '';
        isScanningRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Printable single character key
      if (event.key.length === 1) {
        // If time between keystrokes is small or buffer is already accumulating rapidly
        if (timeSinceLastKey <= maxIntervalMs || bufferRef.current.length === 0) {
          if (timeSinceLastKey <= maxIntervalMs && bufferRef.current.length >= 1) {
            isScanningRef.current = true;
          }
          bufferRef.current += event.key;
        } else {
          // Time gap too long -> Reset buffer to just current key
          bufferRef.current = event.key;
          isScanningRef.current = false;
        }

        // Set a cleanup timeout in case scanner sends characters without an Enter terminator
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          // If we had a fast scan burst with enough characters that didn't send Enter
          if (isScanningRef.current && bufferRef.current.length >= minChars) {
            processBarcode(bufferRef.current);
          }
          bufferRef.current = '';
          isScanningRef.current = false;
        }, maxIntervalMs * 3);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, maxIntervalMs, minChars, processBarcode, suffix]);

  return {
    lastScannedCode,
    lastScannedAt,
    scanCount,
    isListening: enabled,
  };
};
