import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode, Zap } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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

    const initAndStart = async () => {
      // 1. Wait a brief moment to ensure React mounts the DOM element
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!isMounted) return;

      const element = document.getElementById("html5-qr-reader");
      if (!element) {
        setError('Scanner element not found. Please try again.');
        return;
      }

      try {
        qrScanner = new Html5Qrcode("html5-qr-reader", {
          verbose: false,
          useBarCodeDetectorIfSupported: true
        });
        html5QrCodeRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: { ideal: "environment" } },
          {
            fps: 15,
            qrbox: (width, height) => {
              // Custom wide box optimized for barcodes and QR codes
              const qrWidth = Math.min(width * 0.85, inline ? 260 : 320);
              const qrHeight = Math.min(height * 0.6, inline ? 100 : 160);
              return { width: qrWidth, height: qrHeight };
            },
            aspectRatio: inline ? 1.777778 : 1.333333,
          },
          (decodedText) => {
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
          },
          () => {
            // Ignore frame analysis errors/warnings (they fire on every unsuccessful frame)
          }
        );

        if (!isMounted) {
          if (qrScanner && qrScanner.isScanning) {
            await qrScanner.stop();
          }
          return;
        }

        setScanning(true);

        // Check if torch/flashlight is supported
        try {
          const capabilities = qrScanner.getRunningTrackCameraCapabilities();
          if (capabilities && capabilities.torchFeature().isSupported()) {
            setIsTorchSupported(true);
          }
        } catch (torchErr) {
          console.log("Torch capability check failed:", torchErr);
        }

      } catch (err) {
        console.error('Camera start error:', err);
        if (isMounted) {
          setError('Camera not accessible. Please enter barcode manually.');
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
  }, [inline]);

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
          #html5-qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 0.5rem;
          }
          #html5-qr-reader canvas {
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
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-xs text-red-400">
            {error}
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-40 border border-white/5">
            <div id="html5-qr-reader" className="w-full h-full" />
            
            {/* Custom Overlay */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div 
                  className="relative border border-indigo-500/30 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" 
                  style={{
                    width: '85%',
                    height: '60%',
                    maxWidth: '260px',
                    maxHeight: '100px',
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
                    <p className="text-[9px] text-white/70 font-medium tracking-wide">Align code inside frame</p>
                  </div>
                </div>
              </div>
            )}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
      <style dangerouslySetInnerHTML={{__html: `
        #html5-qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem;
        }
        #html5-qr-reader canvas {
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
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
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
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-sm text-red-400">
              {error}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black mb-4 border border-slate-800" style={{ aspectRatio: '4/3' }}>
              <div id="html5-qr-reader" className="w-full h-full" />
              
              {/* Custom Overlay */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div 
                    className="relative border border-indigo-500/30 rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]" 
                    style={{
                      width: '80%',
                      height: '50%',
                      maxWidth: '320px',
                      maxHeight: '160px',
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
                        Point camera at barcode or QR code
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
