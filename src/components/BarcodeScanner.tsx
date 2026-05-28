import React, { useEffect, useRef, useState } from 'react';
import { X, Barcode } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inline?: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, inline = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(null, videoRef.current || null, (result, _err) => {
      if (result) {
        onScan(result.getText());
        reader.reset();
        onClose();
      }
    }).then(() => {
      setScanning(true);
    }).catch(err => {
      console.error('Camera access error:', err);
      setError('Camera not accessible. Please enter barcode manually.');
    });

    return () => {
      reader.reset();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      if (readerRef.current) {
        readerRef.current.reset();
      }
      onClose();
    }
  };

  if (inline) {
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 border border-indigo-500/30 shadow-inner relative animate-in fade-in slide-in-from-top duration-300">
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
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 border border-white/30 rounded relative">
                  <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm"></div>
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm"></div>
                  <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm"></div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-indigo-400 rounded-br-sm"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-400/80 animate-pulse"></div>
                </div>
                <p className="absolute bottom-2 text-[9px] text-white/80 font-medium">Align barcode inside frame</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Barcode className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-800">Barcode Scanner</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
              {error}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black mb-4" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/70 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-indigo-400 rounded-tl"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-indigo-400 rounded-tr"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-indigo-400 rounded-bl"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-indigo-400 rounded-br"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-400/70 animate-pulse"></div>
                  </div>
                  <p className="absolute bottom-4 text-white text-sm font-medium">Point camera at barcode</p>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or enter manually</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Enter barcode..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus={!!error}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
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
