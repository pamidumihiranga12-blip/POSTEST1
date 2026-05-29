import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode, Camera, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inline?: boolean;
}

// Global counter for DOM element IDs to prevent duplicate ID collision
let instanceCounter = 0;

// Sanitizes the raw barcode string by removing prefixes (e.g. "IMEI:") and whitespace while preserving alphanumeric English letters and serial numbers
const sanitizeBarcode = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/[\r\n\t]/g, '')                          // Remove carriage returns, newlines, and tabs
    .replace(/^(imei|sn|s\/n|barcode|qr)[:\-\s]+/i, '') // Remove common labels/prefixes (case-insensitive)
    .replace(/^[^a-zA-Z0-9]+/, '')                     // Remove any leading symbols/punctuation except letters and digits
    .replace(/[^a-zA-Z0-9]+$/, '')                     // Remove any trailing symbols/punctuation except letters and digits
    .trim();
};

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, inline = false }) => {
  const [error, setError] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scannerId] = useState(() => `html5-qr-reader-custom-${++instanceCounter}`);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const hasFiredRef = useRef(false);

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  const handleScanSuccess = (cleanCode: string) => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    // Trigger sweet success audio beep cue
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch POS beep (A5)
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio cue failed:', e);
    }

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current
        .stop()
        .catch(() => {})
        .finally(() => {
          onScanRef.current(cleanCode);
          onCloseRef.current();
        });
    } else {
      onScanRef.current(cleanCode);
      onCloseRef.current();
    }
  };

  const startScanner = async (cameraId: string) => {
    if (!html5QrCodeRef.current) return;

    try {
      setError('');
      setIsLoading(true);

      // Set aspect ratio matching the typical camera (16:9) to keep coordinates completely aligned
      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 22, // Highly responsive scanner fps
          qrbox: (videoWidth, videoHeight) => {
            // Rectangular scanning region optimized for barcode / IMEI scanning
            const w = Math.min(videoWidth * 0.85, 320);
            const h = Math.min(videoHeight * 0.35, 110);
            return { width: w, height: h };
          },
          aspectRatio: 1.777778, // 16:9 aspect ratio matches our container
        },
        (decodedText) => {
          const cleanCode = sanitizeBarcode(decodedText);
          handleScanSuccess(cleanCode);
        },
        () => {
          // Ignore verbose frame failure logs
        }
      );

      setIsScanning(true);
      setIsLoading(false);

      // Check if flashlight (torch) is supported in current browser/device context
      try {
        const capabilities = html5QrCodeRef.current.getRunningTrackCapabilities();
        const hasTorch = capabilities?.torch || false;
        setTorchSupported(hasTorch);
      } catch {
        setTorchSupported(false);
      }
    } catch (err) {
      console.error('Failed to start scanner with camera ID:', err);
      setError('Could not access camera. Please check permissions.');
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  const startScannerWithFacingMode = async () => {
    if (!html5QrCodeRef.current) return;

    try {
      setError('');
      setIsLoading(true);

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 22,
          qrbox: (videoWidth, videoHeight) => {
            const w = Math.min(videoWidth * 0.85, 320);
            const h = Math.min(videoHeight * 0.35, 110);
            return { width: w, height: h };
          },
          aspectRatio: 1.777778,
        },
        (decodedText) => {
          const cleanCode = sanitizeBarcode(decodedText);
          handleScanSuccess(cleanCode);
        },
        () => {}
      );

      setIsScanning(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to start scanner with facing mode:', err);
      setError('Could not access camera. Please check permissions.');
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanning || !torchSupported) return;
    try {
      const nextTorchState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorchState } as any],
      });
      setTorchOn(nextTorchState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  useEffect(() => {
    hasFiredRef.current = false;
    
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.PDF_417
    ];

    // Initialize programmatic UI-less scanner instance with all necessary barcode decoders enabled
    const scanner = new Html5Qrcode(scannerId, {
      formatsToSupport,
      useBarCodeDetectorIfSupported: false // Pure JS decoder to prevent native detector crash bugs
    });
    html5QrCodeRef.current = scanner;

    // Request permissions and list cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Find back camera if available
          const backCamera = devices.find((device) =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('facing back')
          );
          const defaultCameraId = backCamera ? backCamera.id : devices[0].id;
          setActiveCameraId(defaultCameraId);
          startScanner(defaultCameraId);
        } else {
          startScannerWithFacingMode();
        }
      })
      .catch((err) => {
        console.warn('Error fetching cameras list, using default facingMode instead:', err);
        startScannerWithFacingMode();
      });

    return () => {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch((err) => {
            console.warn('Cleanup error stopping scanner:', err);
          });
        }
      }
    };
  }, [scannerId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeBarcode(manualCode);
    if (!cleanCode || hasFiredRef.current) return;
    hasFiredRef.current = true;

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current
        .stop()
        .catch(() => {})
        .finally(() => {
          onScanRef.current(cleanCode);
          onCloseRef.current();
        });
    } else {
      onScanRef.current(cleanCode);
      onCloseRef.current();
    }
  };

  const triggerCameraSwitch = (cameraId: string) => {
    setActiveCameraId(cameraId);
    startScanner(cameraId);
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER MANUAL FALLBACK VIEW (FOR ERRORS / BLOCKED PERMISSIONS)
  ───────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white ${inline ? 'w-full' : 'max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-slate-100">Camera Permission Blocked</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          SmartZone POS requires camera access to scan barcodes. Please enable camera access in your browser settings or enter the code manually below.
        </p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter barcode / IMEI manually..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20 font-semibold"
          >
            Submit
          </button>
        </form>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              startScannerWithFacingMode();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg transition-colors border border-slate-700 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER COMPACT INLINE VIEW
  ───────────────────────────────────────────────────────────── */
  if (inline) {
    return (
      <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-3 shadow-inner relative animate-in fade-in slide-in-from-top duration-300 overflow-hidden w-full max-w-sm">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scan-laser-pulse {
            0% { top: 5%; opacity: 0.8; }
            50% { top: 95%; opacity: 1; }
            100% { top: 5%; opacity: 0.8; }
          }
          .animate-laser {
            animation: scan-laser-pulse 2.2s infinite linear;
          }
          #${scannerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
        `}} />

        <div className="flex items-center justify-between mb-2 z-10 relative">
          <div className="flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide text-slate-200">Barcode Scanner Active</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Camera Container and Overlay */}
        <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black border border-white/5">
          <div id={scannerId} className="w-full h-full" />

          {/* Premium Bounding Frame Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2">
            {/* Center target rectangle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[85%] h-[40%] rounded-md border border-indigo-500/25 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] flex items-center justify-center">
                {/* Neon Corner Brackets */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400 -mt-[1px] -ml-[1px] rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400 -mt-[1px] -mr-[1px] rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400 -mb-[1px] -ml-[1px] rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400 -mb-[1px] -mr-[1px] rounded-br-sm" />

                {/* Sweeping scan laser */}
                <div className="w-[96%] h-[2px] bg-rose-500 shadow-[0_0_8px_1.5px_rgba(244,63,94,0.85)] rounded-full animate-laser absolute" />
              </div>
            </div>

            {/* Bottom mini-dashboard */}
            <div className="flex justify-between items-end z-10 w-full pointer-events-auto mt-auto">
              {cameras.length > 1 ? (
                <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-md px-1.5 py-0.5">
                  <Camera className="w-2.5 h-2.5 text-slate-300" />
                  <select
                    value={activeCameraId}
                    onChange={(e) => triggerCameraSwitch(e.target.value)}
                    className="bg-transparent text-[9px] text-slate-200 outline-none border-none pr-3 font-semibold cursor-pointer"
                  >
                    {cameras.map((camera, idx) => (
                      <option key={camera.id} value={camera.id} className="bg-slate-900 text-slate-200">
                        Camera {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div />
              )}

              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-1 rounded-md border backdrop-blur-md transition-all ${
                    torchOn
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER FULL SCREEN MODAL VIEW
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan-laser-pulse {
          0% { top: 5%; opacity: 0.8; }
          50% { top: 95%; opacity: 1; }
          100% { top: 5%; opacity: 0.8; }
        }
        .animate-laser {
          animation: scan-laser-pulse 2.2s infinite linear;
        }
        #${scannerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}} />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-850">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Barcode className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Automated Scanner</h3>
              <p className="text-[10px] text-slate-400 font-medium">Place barcode/IMEI inside scanner window</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Display Box */}
        <div className="p-4">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner">
            <div id={scannerId} className="w-full h-full" />

            {/* Premium Scanning Mask Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
              {/* Scan box bracket center visualizer */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-[85%] h-[35%] rounded-lg border border-indigo-500/25 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] flex items-center justify-center">
                  {/* Glowing Corners */}
                  <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-indigo-400 -mt-[1px] -ml-[1px] rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-indigo-400 -mt-[1px] -mr-[1px] rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-indigo-400 -mb-[1px] -ml-[1px] rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-indigo-400 -mb-[1px] -mr-[1px] rounded-br-md" />

                  {/* Red Laser Sweep line */}
                  <div className="w-[96%] h-[2px] bg-rose-500 shadow-[0_0_10px_2px_rgba(244,63,94,0.85)] rounded-full animate-laser absolute" />
                </div>
              </div>

              {/* Action Toolbar on Overlay */}
              <div className="flex justify-between items-end z-10 w-full pointer-events-auto mt-auto">
                {cameras.length > 1 ? (
                  <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 shadow-md">
                    <Camera className="w-3.5 h-3.5 text-slate-300" />
                    <select
                      value={activeCameraId}
                      onChange={(e) => triggerCameraSwitch(e.target.value)}
                      className="bg-transparent text-xs text-slate-200 outline-none border-none pr-4 font-semibold cursor-pointer"
                    >
                      {cameras.map((camera, idx) => (
                        <option key={camera.id} value={camera.id} className="bg-slate-900 text-slate-200">
                          Camera {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div />
                )}

                {torchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-lg border backdrop-blur-md transition-all shadow-md ${
                      torchOn
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Divider with beautiful label */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-slate-900 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                or search manually
              </span>
            </div>
          </div>

          {/* Manual Submit Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode / IMEI number..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
              autoFocus={!isScanning}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 active:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
export { sanitizeBarcode };
