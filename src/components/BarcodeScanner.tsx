import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode, Zap } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inline?: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, inline = false }) => {
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [scanMode, setScanMode] = useState<'barcode' | 'qr'>('barcode');
  
  // Unique ID for the scanner DOM element to avoid conflicts
  const [scannerId] = useState(() => `html5-qr-reader-${Math.random().toString(36).substring(2, 9)}`);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const hasFiredRef = useRef(false);

  // Keep parent callbacks in refs to prevent scanner resets when parent re-renders
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    hasFiredRef.current = false;
    let isMounted = true;
    let qrScanner: Html5Qrcode | null = null;

    // Explicit list of all supported formats we want to decode
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.AZTEC,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.MAXICODE,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.PDF_417,
      Html5QrcodeSupportedFormats.RSS_14,
      Html5QrcodeSupportedFormats.RSS_EXPANDED,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
    ];

    const initAndStart = async () => {
      // 1. Check for Secure Context (HTTPS/localhost)
      if (!window.isSecureContext) {
        setError('Camera access is blocked because this connection is not secure (HTTP). Modern browsers require HTTPS (or localhost) to access the camera on mobile devices.');
        return;
      }

      // 2. Check for Camera API support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API is not supported in this browser. Please use Chrome, Safari, or Firefox.');
        return;
      }

      // Wait a brief moment to ensure React mounts the DOM element
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!isMounted) return;

      const element = document.getElementById(scannerId);
      if (!element) {
        setError('Scanner element not found. Please try again.');
        return;
      }

      try {
        // Try initializing with BarcodeDetector API (fast native android decoding)
        try {
          qrScanner = new Html5Qrcode(scannerId, {
            formatsToSupport,
            verbose: false,
            useBarCodeDetectorIfSupported: true
          });
        } catch (initErr) {
          console.warn("Failed to init Html5Qrcode with BarcodeDetector, trying without:", initErr);
          qrScanner = new Html5Qrcode(scannerId, {
            formatsToSupport,
            verbose: false,
            useBarCodeDetectorIfSupported: false
          });
        }
        
        html5QrCodeRef.current = qrScanner;

        // Try to enumerate cameras to find a physical rear camera ID
        let rearCameraId: string | undefined = undefined;
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const rearCamera = cameras.find(camera => {
              const label = camera.label.toLowerCase();
              return label.includes('back') || 
                     label.includes('rear') || 
                     label.includes('environment') || 
                     label.includes('main') ||
                     label.includes('out') ||
                     label.includes('triple') ||
                     label.includes('dual') ||
                     label.includes('camera 0');
            });
            if (rearCamera) {
              rearCameraId = rearCamera.id;
            } else {
              // Fallback to the last camera in the list (usually the rear camera on mobile)
              rearCameraId = cameras[cameras.length - 1].id;
            }
          }
        } catch (e) {
          console.warn("Could not list cameras:", e);
        }

        // Helper to construct scan config. Because html5-qrcode completely ignores the first argument
        // of start() if videoConstraints is set in the scan config, we MUST merge deviceId/facingMode
        // directly inside the videoConstraints object itself.
        const buildScanConfig = (deviceId?: string, forceFacingMode?: boolean) => {
          const videoConstraints: MediaTrackConstraints = {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          };

          if (deviceId && !forceFacingMode) {
            videoConstraints.deviceId = { exact: deviceId };
          } else {
            videoConstraints.facingMode = { ideal: "environment" };
          }

          return {
            fps: 15,
            qrbox: (width: number, height: number) => {
              if (scanMode === 'barcode') {
                // Thin horizontal slit for stacked barcodes / IMEIs
                const w = Math.round(width * 0.85);
                const h = Math.round(height * 0.25);
                return { width: w, height: h };
              } else {
                // Normal square box for QR codes
                const size = Math.round(Math.min(width, height) * 0.65);
                return { width: size, height: size };
              }
            },
            aspectRatio: inline ? 1.777778 : 1.333333,
            videoConstraints
          };
        };

        const onScanSuccess = (decodedText: string) => {
          if (!hasFiredRef.current) {
            hasFiredRef.current = true;
            
            // Stop the scanner first, then call callback
            if (qrScanner && qrScanner.isScanning) {
              qrScanner.stop().then(() => {
                onScanRef.current(decodedText);
                onCloseRef.current();
              }).catch((e) => {
                console.error("Stop on scan success error:", e);
                onScanRef.current(decodedText);
                onCloseRef.current();
              });
            } else {
              onScanRef.current(decodedText);
              onCloseRef.current();
            }
          }
        };

        const onScanFailure = () => {
          // Ignore verbose scanner logs
        };

        // Try sequentially starting the camera using merged constraints:
        let started = false;

        // Attempt 1: Start with specific rear camera ID constraints (most reliable)
        if (rearCameraId && isMounted) {
          try {
            const config = buildScanConfig(rearCameraId, false);
            await qrScanner.start(rearCameraId, config, onScanSuccess, onScanFailure);
            started = true;
          } catch (err) {
            console.warn("Failed starting rear camera by ID constraints, trying facingMode:", err);
          }
        }

        // Attempt 2: Start with facingMode environment constraints (fallback)
        if (!started && isMounted) {
          try {
            const config = buildScanConfig(undefined, true);
            await qrScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
            started = true;
          } catch (err) {
            console.warn("Failed starting camera with facingMode constraints, trying generic resolution:", err);
          }
        }

        // Attempt 3: Let browser pick the default camera but request 1080p (ultimate fallback)
        if (!started && isMounted) {
          try {
            const config = {
              fps: 15,
              qrbox: (width: number, height: number) => {
                if (scanMode === 'barcode') {
                  const w = Math.round(width * 0.85);
                  const h = Math.round(height * 0.25);
                  return { width: w, height: h };
                } else {
                  const size = Math.round(Math.min(width, height) * 0.65);
                  return { width: size, height: size };
                }
              },
              aspectRatio: inline ? 1.777778 : 1.333333,
              videoConstraints: {
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              }
            };
            await qrScanner.start({}, config, onScanSuccess, onScanFailure);
            started = true;
          } catch (err) {
            console.error("All attempts to start camera failed:", err);
            throw err;
          }
        }

        if (!isMounted) {
          if (qrScanner && qrScanner.isScanning) {
            await qrScanner.stop();
          }
          return;
        }

        if (started) {
          setScanning(true);
          
          // Check if torch/flashlight is supported on the active video track
          try {
            const capabilities = qrScanner.getRunningTrackCameraCapabilities();
            if (capabilities && capabilities.torchFeature().isSupported()) {
              setIsTorchSupported(true);
            }
          } catch (torchErr) {
            console.log("Torch capability check failed:", torchErr);
          }
        }

      } catch (err) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          let userFriendlyError = 'Camera not accessible. Please enter barcode manually.';
          if (err instanceof Error) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              userFriendlyError = 'Camera access blocked. Please reset camera permissions in your browser/device settings.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
              userFriendlyError = 'No camera found on this device.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
              userFriendlyError = 'Camera is already in use by another tab or app. Please close other tabs and try again.';
            } else {
              userFriendlyError = `Camera access error: ${err.message} (${err.name})`;
            }
          } else {
            userFriendlyError = `Camera access error: ${String(err)}`;
          }
          setError(userFriendlyError);
        }
      }
    };

    initAndStart();

    return () => {
      isMounted = false;
      if (qrScanner) {
        if (qrScanner.isScanning) {
          qrScanner.stop().catch(err => {
            console.error("Cleanup stop error:", err);
          });
        }
      }
    };
  }, [inline, retryCount, scannerId, scanMode]);

  const handleRetry = () => {
    setError('');
    setScanning(false);
    setIsTorchSupported(false);
    setIsTorchOn(false);
    setRetryCount(prev => prev + 1);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isTorchSupported) return;
    try {
      const nextTorchState = !isTorchOn;
      const capabilities = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
      await capabilities.torchFeature().apply(nextTorchState);
      setIsTorchOn(nextTorchState);
    } catch (err) {
      console.error("Failed to toggle torch:", err);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim() && !hasFiredRef.current) {
      hasFiredRef.current = true;
      
      const submitCode = () => {
        onScanRef.current(manualCode.trim());
        onCloseRef.current();
      };

      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().then(submitCode).catch(e => {
          console.error("Stop on manual submit error:", e);
          submitCode();
        });
      } else {
        submitCode();
      }
    }
  };

  if (inline) {
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 border border-indigo-500/30 shadow-inner relative animate-in fade-in slide-in-from-top duration-300">
        <style dangerouslySetInnerHTML={{__html: `
          .html5-qr-container video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 0.5rem;
          }
          .html5-qr-container canvas {
            display: none !important;
          }
          @keyframes scan-laser {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
          }
          .animate-scanner-laser {
            animation: scan-laser 2s infinite linear;
          }
        `}} />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide text-slate-200">Live Camera Scanner</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 flex flex-col gap-2">
            <p className="leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold w-fit transition-colors shadow hover:shadow-indigo-500/20"
            >
              Retry Camera
            </button>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-40 border border-white/5">
            <div id={scannerId} className="w-full h-full html5-qr-container" />
            
            {/* Custom Overlay */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div 
                  className="relative border border-indigo-500/30 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-300" 
                  style={{
                    width: scanMode === 'barcode' ? '85%' : '65%',
                    height: scanMode === 'barcode' ? '25%' : undefined,
                    aspectRatio: scanMode === 'qr' ? '1/1' : undefined,
                  }}
                >
                  {/* Corner Brackets */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400 rounded-br-sm"></div>
                  
                  {/* Laser Line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_6px_#818cf8] animate-scanner-laser"></div>
                  
                  {/* Text */}
                  <div className="absolute -bottom-6 left-0 right-0 text-center">
                    <p className="text-[9px] text-white/70 font-medium tracking-wide">
                      Align {scanMode === 'barcode' ? 'barcode' : 'QR code'} inside frame
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Switcher */}
            <div className="absolute bottom-2 left-2 flex gap-0.5 pointer-events-auto z-10 bg-black/60 p-0.5 rounded-lg ring-1 ring-white/15 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setScanMode('barcode')}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide transition-all ${
                  scanMode === 'barcode'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                1D Barcode
              </button>
              <button
                type="button"
                onClick={() => setScanMode('qr')}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide transition-all ${
                  scanMode === 'qr'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                QR Code
              </button>
            </div>

            {/* Flashlight/Torch button */}
            {isTorchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-all duration-300 shadow-md pointer-events-auto z-10 flex items-center justify-center ${
                  isTorchOn 
                    ? 'bg-amber-500 text-white scale-105 shadow-amber-500/40 ring-2 ring-amber-500/20' 
                    : 'bg-black/60 text-white/80 hover:bg-black/80 hover:text-white ring-1 ring-white/15 backdrop-blur-md'
                }`}
                title={isTorchOn ? "Turn off flashlight" : "Turn on flashlight"}
              >
                <Zap className={`w-3.5 h-3.5 ${isTorchOn ? 'fill-current animate-pulse' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <style dangerouslySetInnerHTML={{__html: `
        .html5-qr-container video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem;
        }
        .html5-qr-container canvas {
          display: none !important;
        }
        @keyframes scan-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-scanner-laser {
          animation: scan-laser 2s infinite linear;
        }
      `}} />
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Barcode className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-slate-100">Barcode Scanner</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4 text-sm text-red-400 flex flex-col gap-3">
              <p className="leading-relaxed font-medium">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-semibold w-fit transition-colors shadow-lg shadow-indigo-600/20"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black mb-4 border border-slate-800" style={{ aspectRatio: '4/3' }}>
              <div id={scannerId} className="w-full h-full html5-qr-container" />
              
              {/* Custom Overlay */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div 
                    className="relative border border-indigo-500/30 rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] transition-all duration-300" 
                    style={{
                      width: scanMode === 'barcode' ? '85%' : '65%',
                      height: scanMode === 'barcode' ? '25%' : undefined,
                      aspectRatio: scanMode === 'qr' ? '1/1' : undefined,
                    }}
                  >
                    {/* Corner Brackets */}
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-indigo-500 rounded-tl-md"></div>
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-indigo-500 rounded-tr-md"></div>
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-indigo-500 rounded-bl-md"></div>
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-indigo-500 rounded-br-md"></div>
                    
                    {/* Laser Line */}
                    <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-scanner-laser"></div>
                    
                    {/* Guidance Text */}
                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                      <p className="text-xs text-slate-300 font-medium tracking-wide">
                        Point camera at {scanMode === 'barcode' ? 'barcode' : 'QR code'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Switcher */}
              <div className="absolute bottom-3 left-3 flex gap-1 pointer-events-auto z-10 bg-black/60 p-1 rounded-xl ring-1 ring-white/15 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setScanMode('barcode')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                    scanMode === 'barcode'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  1D Barcode (IMEI)
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('qr')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                    scanMode === 'qr'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  QR Code
                </button>
              </div>

              {/* Flashlight/Torch button */}
              {isTorchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`absolute bottom-3 right-3 p-2.5 rounded-full transition-all duration-300 shadow-lg pointer-events-auto z-10 flex items-center justify-center ${
                    isTorchOn 
                      ? 'bg-amber-500 text-white scale-110 shadow-amber-500/40 ring-4 ring-amber-500/20' 
                      : 'bg-black/60 text-white/80 hover:bg-black/80 hover:text-white ring-1 ring-white/15 backdrop-blur-md'
                  }`}
                  title={isTorchOn ? "Turn off flashlight" : "Turn on flashlight"}
                >
                  <Zap className={`w-5 h-5 ${isTorchOn ? 'fill-current animate-pulse' : ''}`} />
                </button>
              )}
            </div>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900 text-slate-400">or enter manually</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Enter barcode..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              autoFocus={!!error}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 active:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
            >
              Search
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
