import React, { useState, useEffect, useRef } from 'react';
import { getProducts } from '../firebase/firestore';
import { Product } from '../store/posStore';
import { Printer, Plus, Minus, Trash2, Search, Settings, Tag, Grid, Layers, Eye, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

// Barcode component for preview
const BarcodeItem: React.FC<{
  value: string;
  width: number;
  height: number;
  name?: string;
  price?: number;
  showName: boolean;
  showPrice: boolean;
  showText: boolean;
  sizeLabel: 'small' | 'medium' | 'large';
}> = ({ value, width, height, name, price, showName, showPrice, showText, sizeLabel }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: showText,
          fontSize: sizeLabel === 'small' ? 9 : sizeLabel === 'medium' ? 12 : 14,
          margin: 2,
          background: 'transparent',
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [value, width, height, showText, sizeLabel]);

  const containerPadding = sizeLabel === 'small' ? 'p-1.5' : sizeLabel === 'medium' ? 'p-3' : 'p-4';

  return (
    <div className={`barcode-label-box bg-white border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-center ${containerPadding} shadow-sm page-break-inside-avoid`}>
      {showName && name && (
        <p className={`font-bold text-gray-800 truncate w-full mb-0.5 leading-tight ${sizeLabel === 'small' ? 'text-[9px]' : sizeLabel === 'medium' ? 'text-xs' : 'text-sm'}`}>
          {name}
        </p>
      )}
      <div className="flex justify-center items-center py-1">
        <svg ref={svgRef} className="max-w-full" />
      </div>
      {showPrice && price !== undefined && (
        <p className={`font-black text-indigo-600 mt-0.5 ${sizeLabel === 'small' ? 'text-[10px]' : sizeLabel === 'medium' ? 'text-xs' : 'text-base'}`}>
          Rs. {price.toLocaleString()}
        </p>
      )}
    </div>
  );
};

interface QueueItem {
  product: Product;
  quantity: number;
}

const BarcodePrint: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  
  // Settings
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      // Filter products that have barcodes
      const withBarcodes = data.filter(p => p.barcode && p.barcode.trim() !== '');
      setProducts(withBarcodes);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const addToQueue = (product: Product) => {
    const existing = queue.find(item => item.product.id === product.id);
    if (existing) {
      setQueue(queue.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setQueue([...queue, { product, quantity: 1 }]);
    }
    toast.success(`Added ${product.name} to print queue`);
  };

  const updateQueueQty = (productId: string, val: number) => {
    setQueue(queue.map(item => 
      item.product.id === productId
        ? { ...item, quantity: Math.max(1, item.quantity + val) }
        : item
    ));
  };

  const removeFromQueue = (productId: string) => {
    setQueue(queue.filter(item => item.product.id !== productId));
    toast.success('Removed from queue');
  };

  const clearQueue = () => {
    setQueue([]);
    toast.success('Print queue cleared');
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode.includes(searchQuery) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate barcode visual settings based on selected size
  const getBarcodeConfig = () => {
    switch (size) {
      case 'small':
        return { width: 1.0, height: 25, cols: 5, colClass: 'grid-cols-5' };
      case 'large':
        return { width: 2.2, height: 65, cols: 2, colClass: 'grid-cols-2' };
      case 'medium':
      default:
        return { width: 1.6, height: 45, cols: 3, colClass: 'grid-cols-3' };
    }
  };

  const config = getBarcodeConfig();

  // Create flat list of labels to render for preview & print
  const flatLabels = queue.flatMap(item => 
    Array.from({ length: item.quantity }, () => item.product)
  );

  const printBarcodes = () => {
    if (flatLabels.length === 0) {
      toast.error('Add some products to the queue first');
      return;
    }

    const htmlLabels = flatLabels.map(p => {
      // Calculate font size & padding for HTML template
      const fontSize = size === 'small' ? '8px' : size === 'medium' ? '11px' : '13px';
      const priceSize = size === 'small' ? '9px' : size === 'medium' ? '12px' : '15px';
      const labelPadding = size === 'small' ? '2mm' : size === 'medium' ? '4mm' : '6mm';

      // SVG dynamic attributes
      const svgWidth = config.width;
      const svgHeight = config.height;

      return `
        <div class="barcode-label" style="padding: ${labelPadding};">
          ${showName ? `<div class="p-name" style="font-size: ${fontSize};">${p.name}</div>` : ''}
          <svg class="barcode-svg" 
               jsbarcode-value="${p.barcode}"
               jsbarcode-width="${svgWidth}"
               jsbarcode-height="${svgHeight}"
               jsbarcode-displayValue="${showText}"
               jsbarcode-fontSize="${size === 'small' ? 9 : size === 'medium' ? 12 : 14}"
               jsbarcode-margin="0">
          </svg>
          ${showPrice ? `<div class="p-price" style="font-size: ${priceSize};">Rs. ${(p.price || 0).toLocaleString()}</div>` : ''}
        </div>
      `;
    }).join('');

    const colsCount = config.cols;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            margin: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: #white;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(${colsCount}, 1fr);
            gap: 5mm;
          }
          .barcode-label {
            box-sizing: border-box;
            border: 1px dashed #ddd;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: white;
            page-break-inside: avoid;
            margin-bottom: 2mm;
          }
          .p-name {
            font-weight: 700;
            margin-bottom: 1mm;
            color: #111;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
          }
          .p-price {
            font-weight: 900;
            color: #4f46e5;
            margin-top: 1mm;
          }
          .barcode-svg {
            max-width: 100%;
          }
          @media print {
            .barcode-label {
              border: 1px dashed #bbb; /* Print guidelines */
            }
          }
        </style>
      </head>
      <body>
        <div class="print-grid">
          ${htmlLabels}
        </div>
        <script>
          window.onload = () => {
            JsBarcode(".barcode-svg").init();
            setTimeout(() => {
              window.print();
              window.onafterprint = () => window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Barcode Label Generator</h1>
          <p className="text-gray-500 text-sm mt-1">Generate and print scannable barcodes in batches on A4 sheet paper</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Product Picker */}
        <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-[calc(100vh-200px)]">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-500" /> Select Products
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white transition-all"
                placeholder="Search products with barcodes..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No products found with barcodes
              </div>
            ) : (
              filtered.map(product => (
                <div
                  key={product.id}
                  onClick={() => addToQueue(product)}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-white transition-colors">
                      <Grid className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{product.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</p>
                    </div>
                  </div>
                  <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors shadow-sm">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Print Queue & Barcode Generator */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Print Queue */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700 flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-500" /> Print Queue ({flatLabels.length} Labels)
              </h2>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/30 space-y-2 mb-4">
              {queue.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Your print queue is empty. Select products from the left to start.
                </div>
              ) : (
                queue.map(item => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">Barcode: {item.product.barcode}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1 bg-gray-50">
                        <button
                          onClick={() => updateQueueQty(item.product.id, -1)}
                          className="p-1 hover:bg-white hover:text-indigo-600 rounded text-gray-500 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-bold text-gray-700 min-w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQueueQty(item.product.id, 1)}
                          className="p-1 hover:bg-white hover:text-indigo-600 rounded text-gray-500 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromQueue(item.product.id)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Label Customizer settings */}
            <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" /> Barcode Settings & Layout
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                {/* Size selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Barcode Size</label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border capitalize transition-all ${
                          size === s
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print attributes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Print Details</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showName}
                        onChange={e => setShowName(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      Name
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPrice}
                        onChange={e => setShowPrice(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      Price
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showText}
                        onChange={e => setShowText(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      Text
                    </label>
                  </div>
                </div>
              </div>

              <button
                onClick={printBarcodes}
                disabled={flatLabels.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-sm hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-5 h-5" /> Print Barcodes (A4 Sheet layout)
              </button>
            </div>
          </div>

          {/* Barcode A4 Preview Section */}
          {flatLabels.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-h-[300px] flex flex-col">
              <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-emerald-500" /> A4 Paper Label Sheet Preview
              </h2>
              
              <div className="flex-1 overflow-auto border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-start justify-center max-h-[350px]">
                {/* Simulated A4 Container */}
                <div className="w-[100%] max-w-lg bg-white shadow-md border border-gray-300 p-4 min-h-[400px]">
                  <div className={`grid ${config.colClass} gap-3`}>
                    {flatLabels.map((p, idx) => (
                      <BarcodeItem
                        key={idx}
                        value={p.barcode}
                        width={config.width}
                        height={config.height}
                        name={p.name}
                        price={p.price}
                        showName={showName}
                        showPrice={showPrice}
                        showText={showText}
                        sizeLabel={size}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodePrint;
