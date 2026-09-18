import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { Barcode, Camera, CheckCircle2, Flashlight, RefreshCw, X } from 'lucide-react';

interface CameraBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const REAR_CAMERA_KEYWORDS = [
  'back',
  'rear',
  'environment',
  'trasera',
  'posterior',
  'dorsal',
  'world',
];

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  onClose,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastDecodedRef = useRef('');
  const lastDecodedAtRef = useRef(0);

  const [status, setStatus] = useState<'starting' | 'ready' | 'success' | 'error'>('starting');
  const [statusMessage, setStatusMessage] = useState('Solicitando acceso a la cámara trasera…');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {
      // El scanner puede estar detenido si el navegador cerró el stream.
    }

    try {
      scanner.clear();
    } catch {
      // No-op: clear puede fallar si el elemento ya fue desmontado.
    }
  }, []);

  const startWithCamera = useCallback(async (camera: string | MediaTrackConstraints) => {
    const scanner = new Html5Qrcode('camera-barcode-reader', {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });

    scannerRef.current = scanner;

    const config = {
      fps: 12,
      aspectRatio: 1.777778,
      disableFlip: true,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.min(Math.floor(viewfinderWidth * 0.88), 620);
        const height = Math.min(Math.max(110, Math.floor(viewfinderHeight * 0.28)), 190);
        return { width, height };
      },
    };

    await scanner.start(
      camera,
      config,
      async (decodedText) => {
        const clean = decodedText.trim();
        if (!clean) return;

        const now = Date.now();
        if (clean === lastDecodedRef.current && now - lastDecodedAtRef.current < 1800) {
          return;
        }

        lastDecodedRef.current = clean;
        lastDecodedAtRef.current = now;

        if (mountedRef.current) {
          setStatus('success');
          setStatusMessage(`Código detectado: ${clean}`);
        }

        onScan(clean);
      },
      () => {
        // Los frames sin código son normales; no mostrar errores al usuario.
      },
    );

    try {
      const settings = scanner.getRunningTrackSettings();
      if (settings.facingMode === 'user') {
        throw new Error('El navegador seleccionó la cámara frontal.');
      }
    } catch (error) {
      await stopScanner();
      throw error;
    }

    try {
      const capabilities = scanner.getRunningTrackCapabilities();
      setTorchSupported(Boolean((capabilities as MediaTrackCapabilities & { torch?: boolean }).torch));
    } catch {
      setTorchSupported(false);
    }

    if (mountedRef.current) {
      setStatus('ready');
      setStatusMessage('Apunta la cámara trasera al código de barras y encuádralo dentro del recuadro.');
    }
  }, [onScan]);

  const startCamera = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    await stopScanner();

    if (mountedRef.current) {
      setStatus('starting');
      setStatusMessage('Activando cámara trasera…');
      setTorchOn(false);
    }

    try {
      // Primero solicitamos permiso y buscamos explícitamente una cámara trasera
      // por su etiqueta. Esto evita depender de que el navegador recuerde
      // accidentalmente la cámara frontal usada anteriormente.
      const cameras = await Html5Qrcode.getCameras();
      const rearCamera = cameras.find((camera) => {
        const label = camera.label.toLowerCase();
        return REAR_CAMERA_KEYWORDS.some((keyword) => label.includes(keyword));
      });

      if (rearCamera) {
        await startWithCamera(rearCamera.id);
        return;
      }

      // Si el navegador no expone etiquetas útiles, exigimos environment.
      await startWithCamera({ facingMode: { exact: 'environment' } });
    } catch (error) {
      console.error('No se pudo iniciar el escáner de cámara:', error);
      if (mountedRef.current) {
        setStatus('error');
        setStatusMessage(
          'No fue posible activar la cámara trasera. Verifica el permiso de cámara del navegador y vuelve a intentarlo.',
        );
      }
    } finally {
      startingRef.current = false;
    }
  }, [startWithCamera, stopScanner]);

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, [startCamera, stopScanner]);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !torchSupported) return;

    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      } as MediaTrackConstraints);

      setTorchOn((value) => !value);
    } catch {
      setStatusMessage('La linterna no está disponible en este dispositivo.');
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-300">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Escanear código de barras</h3>
              <p className="text-[11px] text-slate-400">Cámara trasera del teléfono</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar cámara"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative bg-black">
          <div
            id="camera-barcode-reader"
            className="min-h-[min(68vh,520px)] w-full overflow-hidden"
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[25%] w-[88%] max-w-[620px] rounded-xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">
              <span className="absolute left-0 top-0 h-5 w-5 -translate-x-0.5 -translate-y-0.5 border-l-4 border-t-4 border-emerald-300" />
              <span className="absolute right-0 top-0 h-5 w-5 translate-x-0.5 -translate-y-0.5 border-r-4 border-t-4 border-emerald-300" />
              <span className="absolute bottom-0 left-0 h-5 w-5 -translate-x-0.5 translate-y-0.5 border-b-4 border-l-4 border-emerald-300" />
              <span className="absolute bottom-0 right-0 h-5 w-5 translate-x-0.5 translate-y-0.5 border-b-4 border-r-4 border-emerald-300" />
              <span className="absolute left-2 right-2 top-1/2 h-px bg-emerald-300/80 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className="rounded-lg bg-black/70 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur">
              {status === 'success' ? (
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {statusMessage}
                </span>
              ) : (
                statusMessage
              )}
            </div>

            <div className="flex gap-2">
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`rounded-lg px-3 py-2 text-[11px] font-bold backdrop-blur transition ${
                    torchOn
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-black/70 text-white hover:bg-slate-800'
                  }`}
                >
                  <Flashlight className="mr-1 inline h-3.5 w-3.5" />
                  {torchOn ? 'Apagar' : 'Linterna'}
                </button>
              )}

              <button
                type="button"
                onClick={() => void startCamera()}
                className="rounded-lg bg-black/70 px-3 py-2 text-[11px] font-bold text-white backdrop-blur transition hover:bg-slate-800"
              >
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                Reiniciar
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-3 text-[11px] text-slate-400">
          <Barcode className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            Coloca el código de barras horizontalmente dentro del recuadro. Al detectarlo, el producto se agregará automáticamente al ticket.
          </span>
        </div>
      </div>
    </div>
  );
};
