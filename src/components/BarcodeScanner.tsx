import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode, Zap } from 'lucide-react';
import {
  Html5QrcodeScanner,
  Html5QrcodeScanType,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inline?: boolean;
}

// Unique counter so multiple scanner instances never share the same DOM id
let instanceCounter = 0;

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, inline = false }) => {
  const [error, setError] = useState<string>('');
  const [manualCode, setManualCode] = useState('');

  // Stable unique id for this mount
  const [scannerId] = useState(() => `html5-qr-reader-${++instanceCounter}`);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const hasFiredRef = useRef(false);

  // Keep callbacks in refs so the scanner effect doesn't need them as deps
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    hasFiredRef.current = false;

    // Formats that cover: QR codes, IMEI (Code 128), EAN, UPC, Code 39/93, ITF, Codabar
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
    ];

    const scanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps: 15,
        // Fixed pixel qrbox that works well for IMEI/SN barcodes (wide rectangle)
        qrbox: { width: 280, height: 120 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        formatsToSupport,
        // Use ZXing JS decoder — avoids Chrome's native BarcodeDetector
        // which often misses 1D barcodes on Android
        useBarCodeDetectorIfSupported: false,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    const onScanSuccess = (decodedText: string) => {
      if (hasFiredRef.current) return;
      hasFiredRef.current = true;

      scanner
        .clear()
        .catch(() => {})
        .finally(() => {
          onScanRef.current(decodedText);
          onCloseRef.current();
        });
    };

    const onScanFailure = () => {
      // Suppress per-frame failure noise
    };

    try {
      scanner.render(onScanSuccess, onScanFailure);
    } catch (err) {
      console.error('Scanner render error:', err);
      setError('Camera could not be started. Please check permissions.');
    }

    return () => {
      scanner.clear().catch(() => {});
    };
    // scannerId is stable for the lifetime of this mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || hasFiredRef.current) return;
    hasFiredRef.current = true;

    const finish = () => {
      onScanRef.current(code);
      onCloseRef.current();
    };

    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {}).finally(finish);
    } else {
      finish();
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Inline variant (compact, used inside forms / stock update)
  ───────────────────────────────────────────────────────────── */
  if (inline) {
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 border border-indigo-500/30 shadow-inner relative animate-in fade-in slide-in-from-top duration-300">
        <style dangerouslySetInnerHTML={{__html: `
          /* Strip html5-qrcode's own chrome so only the video shows */
          #${scannerId} > img,
          #${scannerId} > br,
          #${scannerId} select,
          #${scannerId} button,
          #${scannerId} span,
          #${scannerId} p {
            display: none !important;
          }
          #${scannerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 0.5rem;
          }
          #${scannerId} canvas { display: none !important; }
          @keyframes scan-laser {
            0%   { top: 0%; }
            50%  { top: 100%; }
            100% { top: 0%; }
          }
          .scanner-laser { animation: scan-laser 2s infinite linear; }
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
            <p className="leading-relaxed mb-2">{error}</p>
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
            {/* html5-qrcode renders the video into this div */}
            <div id={scannerId} className="w-full h-full" />

            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="relative border border-indigo-500/40 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{ width: 280, height: 120 }}
              >
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400 rounded-br-sm" />
                {/* Scanning laser */}
                <div className="absolute left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_6px_#818cf8] scanner-laser" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     Full-screen modal variant
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <style dangerouslySetInnerHTML={{__html: `
        /* Strip html5-qrcode UI chrome */
        #${scannerId} > img,
        #${scannerId} > br,
        #${scannerId} select,
        #${scannerId} button,
        #${scannerId} span,
        #${scannerId} p {
          display: none !important;
        }
        #${scannerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem;
        }
        #${scannerId} canvas { display: none !important; }
        @keyframes scan-laser {
          0%   { top: 0%; }
          50%  { top: 100%; }
          100% { top: 0%; }
        }
        .scanner-laser { animation: scan-laser 2s infinite linear; }
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
              {/* html5-qrcode renders the video into this div */}
              <div id={scannerId} className="w-full h-full" />

              {/* Viewfinder overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="relative border border-indigo-500/40 rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]"
                  style={{ width: 280, height: 120 }}
                >
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-indigo-500 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-indigo-500 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-indigo-500 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-indigo-500 rounded-br-md" />
                  {/* Scanning laser */}
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_#6366f1] scanner-laser" />
                  {/* Guidance text */}
                  <div className="absolute -bottom-7 left-0 right-0 text-center">
                    <p className="text-xs text-slate-300 font-medium tracking-wide">Point at barcode, IMEI, or QR code</p>
                  </div>
                </div>
              </div>
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
