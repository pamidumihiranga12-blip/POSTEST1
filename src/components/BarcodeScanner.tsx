import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode } from 'lucide-react';
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

// Global counter for DOM element IDs
let instanceCounter = 0;

// Sanitizes the raw barcode string by removing prefixes (e.g. "IMEI:") and whitespace
const sanitizeBarcode = (raw: string): string => {
  return raw
    .replace(/[\r\n\t]/g, '')        // Remove carriage returns, newlines, and tabs
    .replace(/^[^0-9]*/, '')        // Remove any leading non-numeric characters (like "IMEI:")
    .replace(/[^0-9]*$/, '')        // Remove any trailing non-numeric characters
    .trim();
};

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, inline = false }) => {
  const [error, setError] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [scannerId] = useState(() => `html5-qr-reader-${++instanceCounter}`);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const hasFiredRef = useRef(false);

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    hasFiredRef.current = false;

    // Direct support for all standard 1D/2D formats (IMEI, SN, QR)
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

    // Initialize high-level scanner (matches the user's working app.js configuration)
    const scanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps: 15,
        qrbox: { width: 280, height: 120 }, // Standard box size that works well for horizontal barcodes
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        formatsToSupport,
        useBarCodeDetectorIfSupported: false // Pure JS decoder to prevent native detector crash bugs
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    const onScanSuccess = (decodedText: string) => {
      if (hasFiredRef.current) return;
      hasFiredRef.current = true;

      const cleanCode = sanitizeBarcode(decodedText);

      scanner
        .clear()
        .catch(() => {})
        .finally(() => {
          onScanRef.current(cleanCode);
          onCloseRef.current();
        });
    };

    const onScanFailure = () => {
      // Ignore frame failure logs
    };

    try {
      scanner.render(onScanSuccess, onScanFailure);
    } catch (err) {
      console.error('Scanner start error:', err);
      setError('Could not access camera. Please check permissions.');
    }

    return () => {
      scanner.clear().catch(err => {
        console.warn('Scanner cleanup error:', err);
      });
    };
  }, [scannerId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeBarcode(manualCode);
    if (!cleanCode || hasFiredRef.current) return;
    hasFiredRef.current = true;

    const finalize = () => {
      onScanRef.current(cleanCode);
      onCloseRef.current();
    };

    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {}).finally(finalize);
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
          #${scannerId} {
            border: none !important;
            background: transparent !important;
          }
          #${scannerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 0.5rem;
          }
          #${scannerId} canvas { display: none !important; }
          #${scannerId} img[alt="Info icon"] { display: none !important; }
          #${scannerId} #html5-qrcode-anchor-scan-type-change { display: none !important; }
          
          /* Style buttons */
          #${scannerId} button {
            background-color: #6366f1 !important;
            color: white !important;
            border: none !important;
            padding: 8px 16px !important;
            border-radius: 0.5rem !important;
            font-weight: 600 !important;
            font-size: 0.75rem !important;
            cursor: pointer !important;
            margin: 8px auto !important;
            display: block !important;
            transition: all 0.2s !important;
          }
          #${scannerId} button:hover {
            background-color: #4f46e5 !important;
          }
          /* Style dropdown */
          #${scannerId} select {
            padding: 6px 10px !important;
            border-radius: 0.5rem !important;
            border: 1px solid #334155 !important;
            font-size: 0.75rem !important;
            background-color: #1e293b !important;
            color: white !important;
            width: 100% !important;
            max-width: 280px !important;
            margin: 6px auto !important;
            display: block !important;
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
          <div className="relative rounded-lg overflow-hidden bg-black border border-white/5 p-2">
            <div id={scannerId} className="w-full" />
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
        #${scannerId} {
          border: none !important;
          background: transparent !important;
        }
        #${scannerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem;
        }
        #${scannerId} canvas { display: none !important; }
        #${scannerId} img[alt="Info icon"] { display: none !important; }
        #${scannerId} #html5-qrcode-anchor-scan-type-change { display: none !important; }
        
        /* Style buttons */
        #${scannerId} button {
          background-color: #6366f1 !important;
          color: white !important;
          border: none !important;
          padding: 10px 20px !important;
          border-radius: 0.5rem !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
          cursor: pointer !important;
          margin: 10px auto !important;
          display: block !important;
          transition: all 0.2s !important;
        }
        #${scannerId} button:hover {
          background-color: #4f46e5 !important;
        }
        /* Style dropdown */
        #${scannerId} select {
          padding: 8px 12px !important;
          border-radius: 0.5rem !important;
          border: 1px solid #334155 !important;
          font-size: 0.875rem !important;
          background-color: #1e293b !important;
          color: white !important;
          width: 100% !important;
          max-width: 320px !important;
          margin: 8px auto !important;
          display: block !important;
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
            <div className="relative rounded-xl overflow-hidden bg-black mb-4 border border-slate-800 p-2">
              <div id={scannerId} className="w-full" />
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
export { sanitizeBarcode };
