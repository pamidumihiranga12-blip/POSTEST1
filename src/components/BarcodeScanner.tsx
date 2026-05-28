import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode, Zap, RefreshCw } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inline?: boolean;
}

// Generate unique ID for scanner container
let instanceCounter = 0;

interface Html5QrcodeCamera {
  id: string;
  label: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, inline = false }) => {
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameras, setCameras] = useState<Html5QrcodeCamera[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  
  // Stable unique ID for this instance's DOM container
  const [scannerId] = useState(() => `html5-qr-reader-${++instanceCounter}`);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const hasFiredRef = useRef(false);

  // Maintain callback refs to prevent resets if parent updates them
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  // Handle successful scan
  const onScanSuccess = (decodedText: string) => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    const finalize = () => {
      onScanRef.current(decodedText.trim());
      onCloseRef.current();
    };

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().then(finalize).catch((err) => {
        console.error("Error stopping scanner after success:", err);
        finalize();
      });
    } else {
      finalize();
    }
  };

  const onScanFailure = () => {
    // Silent fail for frame-by-frame processing
  };

  useEffect(() => {
    hasFiredRef.current = false;
    let isMounted = true;

    // Supported scan formats covering standard barcodes, IMEIs, and QR codes
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

    const initScanner = async () => {
      // 1. Ensure security context (HTTPS/localhost)
      if (!window.isSecureContext) {
        setError('Camera access requires a secure connection (HTTPS or localhost). Please switch to HTTPS.');
        return;
      }

      // 2. Ensure getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera scanning is not supported by your browser. Please try Chrome, Firefox, or Safari.');
        return;
      }

      // Allow DOM to settle before rendering
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!isMounted) return;

      const container = document.getElementById(scannerId);
      if (!container) {
        setError('Scanner element not found.');
        return;
      }

      try {
        // Instantiate the scanner with JS-only ZXing engine to prevent native detector crash bugs
        const qrScanner = new Html5Qrcode(scannerId, {
          formatsToSupport,
          verbose: false,
          useBarCodeDetectorIfSupported: false
        });
        html5QrCodeRef.current = qrScanner;

        // Fetch cameras
        let camerasList: Html5QrcodeCamera[] = [];
        try {
          camerasList = await Html5Qrcode.getCameras();
          if (isMounted) {
            setCameras(camerasList);
          }
        } catch (e) {
          console.warn("Failed to retrieve camera list:", e);
        }

        // Set default configurations
        const scanConfig = {
          fps: 20, // 20 frames/sec for ultra-fast, real-time scanning
          // Omit qrbox: scans the entire frame at full resolution to maximize success rate!
          // We render a CSS visual box instead.
        };

        // Camera selection priority
        let cameraIdToStart: string | { facingMode: string } = { facingMode: "environment" };
        
        if (camerasList.length > 0) {
          // Look for rear camera
          const rearKeywords = ['back', 'rear', 'environment', 'main', 'out', 'triple', 'dual', 'camera 0'];
          let selectedCamera = null;
          
          for (const key of rearKeywords) {
            const match = camerasList.find(c => c.label.toLowerCase().includes(key));
            if (match) {
              selectedCamera = match;
              break;
            }
          }
          
          if (!selectedCamera) {
            // Fallback to the last camera (typically rear camera on phones)
            selectedCamera = camerasList[camerasList.length - 1];
          }

          if (isMounted) {
            setActiveCameraId(selectedCamera.id);
          }
          cameraIdToStart = selectedCamera.id;
        }

        // Start scanning
        await qrScanner.start(
          cameraIdToStart,
          scanConfig,
          onScanSuccess,
          onScanFailure
        );

        if (isMounted) {
          setScanning(true);
          // Check flashlight capabilities
          try {
            const capabilities = qrScanner.getRunningTrackCameraCapabilities();
            if (capabilities && capabilities.torchFeature().isSupported()) {
              setIsTorchSupported(true);
            }
          } catch {}
        }
      } catch (err) {
        console.error("Camera start failed:", err);
        
        // Final fallback: Try opening with no constraints
        try {
          if (html5QrCodeRef.current && isMounted) {
            await html5QrCodeRef.current.start(
              {},
              { fps: 20 },
              onScanSuccess,
              onScanFailure
            );
            if (isMounted) {
              setScanning(true);
            }
            return;
          }
        } catch (fallbackErr) {
          console.error("Fallback camera start failed:", fallbackErr);
        }

        if (isMounted) {
          let userFriendlyError = 'Could not access the camera.';
          if (err instanceof Error) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              userFriendlyError = 'Camera permission was denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
              userFriendlyError = 'Camera is already in use by another app or browser tab.';
            } else if (err.name === 'OverconstrainedError') {
              userFriendlyError = 'Requested camera resolution/aspect constraints are not supported by your device.';
            } else {
              userFriendlyError = `${err.message}`;
            }
          }
          setError(userFriendlyError);
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => {
          console.warn("Cleanup stop error:", err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerId]);

  // Switch between cameras
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1 || !html5QrCodeRef.current || !scanning) return;
    
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    
    try {
      setScanning(false);
      setIsTorchSupported(false);
      setIsTorchOn(false);
      
      await html5QrCodeRef.current.stop();
      
      setActiveCameraId(nextCamera.id);
      await html5QrCodeRef.current.start(
        nextCamera.id,
        { fps: 20 },
        onScanSuccess,
        onScanFailure
      );
      setScanning(true);
      
      try {
        const capabilities = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
        if (capabilities && capabilities.torchFeature().isSupported()) {
          setIsTorchSupported(true);
        }
      } catch {}
    } catch (err) {
      console.error("Failed to switch camera:", err);
      setError("Failed to switch camera: " + nextCamera.label);
    }
  };

  // Toggle flashlight
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isTorchSupported) return;
    try {
      const nextState = !isTorchOn;
      const capabilities = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
      await capabilities.torchFeature().apply(nextState);
      setIsTorchOn(nextState);
    } catch (err) {
      console.error("Flashlight control failed:", err);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || hasFiredRef.current) return;
    hasFiredRef.current = true;

    const finalize = () => {
      onScanRef.current(code);
      onCloseRef.current();
    };

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().then(finalize).catch(() => finalize());
    } else {
      finalize();
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Inline Layout (compact view inside forms / stock list)
  ───────────────────────────────────────────────────────────── */
  if (inline) {
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 border border-indigo-500/30 shadow-inner relative animate-in fade-in slide-in-from-top duration-300">
        <style dangerouslySetInnerHTML={{__html: `
          #${scannerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 0.5rem;
          }
          #${scannerId} canvas { display: none !important; }
          #${scannerId} { width: 100% !important; height: 100% !important; }
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
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
            <p className="leading-relaxed mb-2 font-medium">{error}</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2 mt-1">
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Enter code manually…"
                className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              <button type="submit" className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold">
                OK
              </button>
            </form>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-52 border border-white/5">
            <div id={scannerId} className="w-full h-full" />
            
            {/* Viewfinder overlay */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[82%] h-[46%] relative border border-emerald-500/40 rounded shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />
                  
                  {/* Scanning laser */}
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/80 shadow-[0_0_6px_#34d399] animate-scanner-laser" />
                </div>
              </div>
            )}

            {/* Quick Actions (Flashlight & Switch Camera) */}
            {scanning && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 pointer-events-auto z-10">
                {isTorchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-1.5 rounded-full transition-all duration-300 shadow ${
                      isTorchOn 
                        ? 'bg-amber-500 text-white scale-105 shadow-amber-500/40' 
                        : 'bg-black/60 text-white/80 hover:bg-black/80 ring-1 ring-white/10 backdrop-blur-sm'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                )}
                {cameras.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="p-1.5 rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-all ring-1 ring-white/10 backdrop-blur-sm shadow"
                    title="Switch camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     Full-Screen Modal Layout
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <style dangerouslySetInnerHTML={{__html: `
        #${scannerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem;
        }
        #${scannerId} canvas { display: none !important; }
        #${scannerId} { width: 100% !important; height: 100% !important; }
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Barcode className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-slate-100">Barcode / IMEI Scanner</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4 text-sm text-red-400 flex flex-col gap-3">
              <p className="leading-relaxed font-medium">{error}</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black mb-4 border border-slate-800" style={{ aspectRatio: '4/3' }}>
              <div id={scannerId} className="w-full h-full" />

              {/* Viewfinder overlay */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[80%] h-[40%] relative border border-emerald-500/40 rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]">
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-500 rounded-tl-md" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-500 rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-500 rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-500 rounded-br-md" />
                    
                    {/* Scanning laser */}
                    <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_#34d399] animate-scanner-laser" />
                    
                    {/* Guidance Text */}
                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                      <p className="text-xs text-slate-300 font-medium tracking-wide bg-slate-900/90 backdrop-blur px-2.5 py-0.5 rounded-full mx-auto w-fit">
                        Align barcode / IMEI in the center
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions (Flashlight & Switch Camera) */}
              {scanning && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-auto z-10">
                  {isTorchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2.5 rounded-full transition-all duration-300 shadow-lg ${
                        isTorchOn 
                          ? 'bg-amber-500 text-white scale-110 shadow-amber-500/40 ring-4 ring-amber-500/20' 
                          : 'bg-black/60 text-white/80 hover:bg-black/80 ring-1 ring-white/15 backdrop-blur-md'
                      }`}
                      title={isTorchOn ? "Turn off flashlight" : "Turn on flashlight"}
                    >
                      <Zap className="w-5 h-5" />
                    </button>
                  )}
                  {cameras.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="p-2.5 rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-all ring-1 ring-white/15 backdrop-blur-md shadow-lg"
                      title="Switch camera"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
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
              placeholder="Enter barcode / IMEI…"
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
