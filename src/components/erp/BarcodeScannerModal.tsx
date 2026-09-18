import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import JsBarcode from 'jsbarcode';
import { Product, SystemSettings } from '../../types';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { exportToCSV } from '../../utils/exportUtils';
import {
  X,
  Camera,
  Search,
  Barcode,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  Sparkles,
  Layers,
  ArrowRight,
  Edit2,
  Printer,
  Copy,
  Check,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Upload,
  History,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  MapPin,
  Warehouse,
  Boxes,
  Zap,
} from 'lucide-react';

interface ScannedHistoryItem {
  id: string;
  code: string;
  matchedProduct: Product | null;
  timestamp: Date;
  matchType: 'sku' | 'barcode' | 'ean' | 'presentation' | 'supplier' | 'fuzzy' | 'none';
  matchedPresentationName?: string;
  matchedSupplierName?: string;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: SystemSettings;
  onAdjustStock: (productId: string, quantity: number, reason: string) => void;
  onEditProduct?: (product: Product) => void;
  onOpenBarcodeLabels?: (product: Product) => void;
}

// Sound effects using Web Audio API
const playBeep = (type: 'success' | 'error' | 'click') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Pleasant high double beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.setValueAtTime(1760, ctx.currentTime + 0.08);
      gain1.setValueAtTime(0.25, ctx.currentTime);
      gain1.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.22);
    } else if (type === 'error') {
      // Low buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.setValueAtTime(0.3, ctx.currentTime);
      gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Soft click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.setValueAtTime(0.15, ctx.currentTime);
      gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) {
    // AudioContext might be blocked until user interacts
  }
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  onAdjustStock,
  onEditProduct,
  onOpenBarcodeLabels,
}) => {
  // Mode selection
  const [scannerTab, setScannerTab] = useState<'camera' | 'file' | 'manual'>('camera');
  const [scanMode, setScanMode] = useState<'single' | 'continuous'>('single');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Camera state
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchCapability, setHasTorchCapability] = useState(false);

  // Scanned results & Lookup
  const [currentScannedCode, setCurrentScannedCode] = useState<string>('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [matchedDetail, setMatchedDetail] = useState<{
    type: 'sku' | 'barcode' | 'ean' | 'presentation' | 'supplier' | 'fuzzy' | 'none';
    info?: string;
  }>({ type: 'none' });
  const [scanHistory, setScanHistory] = useState<ScannedHistoryItem[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Manual input state
  const [manualInput, setManualInput] = useState('');

  // Quick Adjustment in Scanner state
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('Entrada por reposición física');
  const [justAdjusted, setJustAdjusted] = useState<boolean>(false);

  // References
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'erp-barcode-scanner-viewport';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScannerTab('camera');
      setCameraError(null);
      setCurrentScannedCode('');
      setMatchedProduct(null);
      setMatchedDetail({ type: 'none' });
      setJustAdjusted(false);
    } else {
      stopCameraScanner();
    }
  }, [isOpen]);

  // Product Lookup Logic by SKU / EAN-13 / Presentation / Supplier Barcode
  const findProductByCode = (rawCode: string): { product: Product | null; detail: { type: 'sku' | 'barcode' | 'ean' | 'presentation' | 'supplier' | 'fuzzy' | 'none'; info?: string } } => {
    if (!rawCode || !rawCode.trim()) {
      return { product: null, detail: { type: 'none' } };
    }

    const clean = rawCode.trim();
    const cleanUpper = clean.toUpperCase();

    // 1. Exact match on SKU / Product Code
    const matchBySku = products.find((p) => p.code && p.code.trim().toUpperCase() === cleanUpper);
    if (matchBySku) {
      return { product: matchBySku, detail: { type: 'sku', info: `Coincidencia exacta por SKU: ${matchBySku.code}` } };
    }

    // 2. Exact match on Product Barcode / EAN-13
    const matchByBarcode = products.find(
      (p) => (p.barcode && p.barcode.trim() === clean) || (p.ean && p.ean.trim() === clean)
    );
    if (matchByBarcode) {
      return { product: matchByBarcode, detail: { type: 'barcode', info: `Código de barras EAN-13: ${clean}` } };
    }

    // 3. Match inside Product Presentations (e.g., Bulto x 24, Caja x 12 with own barcode)
    for (const p of products) {
      if (p.presentations && p.presentations.length > 0) {
        const presMatch = p.presentations.find((pres) => pres.barcode && pres.barcode.trim() === clean);
        if (presMatch) {
          return {
            product: p,
            detail: {
              type: 'presentation',
              info: `Presentación: ${presMatch.name} (Factor: x${presMatch.factor}) - Código: ${clean}`,
            },
          };
        }
      }
    }

    // 4. Match inside Product Suppliers Info
    for (const p of products) {
      if (p.suppliersInfo && p.suppliersInfo.length > 0) {
        const suppMatch = p.suppliersInfo.find((s) => s.barcode && s.barcode.trim() === clean);
        if (suppMatch) {
          return {
            product: p,
            detail: {
              type: 'supplier',
              info: `Código de Proveedor: ${suppMatch.supplierName} - Ref: ${clean}`,
            },
          };
        }
      }
    }

    // 5. Fuzzy / Substring fallback (if code contains SKU or name contains search)
    const fuzzyMatch = products.find(
      (p) =>
        (p.code && p.code.toUpperCase().includes(cleanUpper)) ||
        (cleanUpper.length >= 4 && p.name.toUpperCase().includes(cleanUpper))
    );
    if (fuzzyMatch) {
      return { product: fuzzyMatch, detail: { type: 'fuzzy', info: `Coincidencia aproximada con ${fuzzyMatch.name}` } };
    }

    return { product: null, detail: { type: 'none' } };
  };

  // Handle a successfully scanned code
  const handleBarcodeDetected = (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return;
    const trimmed = rawCode.trim();

    // Debounce duplicate scans within 1.5 seconds in continuous mode
    const now = Date.now();
    if (lastScannedCodeRef.current.code === trimmed && now - lastScannedCodeRef.current.time < 1500) {
      return;
    }
    lastScannedCodeRef.current = { code: trimmed, time: now };

    setCurrentScannedCode(trimmed);
    const lookupResult = findProductByCode(trimmed);

    if (lookupResult.product) {
      setMatchedProduct(lookupResult.product);
      setMatchedDetail(lookupResult.detail);
      setJustAdjusted(false);

      if (soundEnabled) playBeep('success');

      // Vibrate if supported
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([70, 50, 70]);
        } catch (e) {}
      }

      // Add to session scan history
      setScanHistory((prev) => [
        {
          id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          code: trimmed,
          matchedProduct: lookupResult.product,
          timestamp: new Date(),
          matchType: lookupResult.detail.type,
          matchedPresentationName:
            lookupResult.detail.type === 'presentation' ? lookupResult.detail.info : undefined,
          matchedSupplierName:
            lookupResult.detail.type === 'supplier' ? lookupResult.detail.info : undefined,
        },
        ...prev.slice(0, 49), // Keep last 50
      ]);

      // If single-scan mode, we can pause or keep showing
    } else {
      setMatchedProduct(null);
      setMatchedDetail({ type: 'none' });
      if (soundEnabled) playBeep('error');

      // Add not-found to history
      setScanHistory((prev) => [
        {
          id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          code: trimmed,
          matchedProduct: null,
          timestamp: new Date(),
          matchType: 'none',
        },
        ...prev.slice(0, 49),
      ]);
    }
  };

  // Initialize and start Camera Scanner
  const startCameraScanner = async (cameraId?: string) => {
    try {
      setCameraError(null);
      setIsScanningActive(false);

      // Check camera devices
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No se detectaron cámaras en este dispositivo. Puedes usar el buscador manual o cargar una imagen con código de barras.');
      }

      setCameras(devices);
      const targetCamId = cameraId || selectedCameraId || devices[0].id;
      setSelectedCameraId(targetCamId);

      // Stop previous instance if running
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      }

      // Create new instance
      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Optimized rectangle for 1D barcodes and 2D QR codes
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(Math.min(viewfinderWidth * 0.85, 340)),
            height: Math.floor(Math.min(viewfinderHeight * 0.55, 200)),
          };
        },
        aspectRatio: 1.333334,
      };

      await html5QrCode.start(
        targetCamId,
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        (_errorMessage) => {
          // Frame by frame parse failures are normal while scanning
        }
      );

      setIsScanningActive(true);
      setHasPermission(true);

      // Check torch capability
      try {
        const track = (html5QrCode as any).getRunningTrackCameraCapabilities?.();
        if (track && track.torchFeature && track.torchFeature().isSupported()) {
          setHasTorchCapability(true);
        }
      } catch (e) {
        setHasTorchCapability(false);
      }
    } catch (err: any) {
      console.warn('Barcode camera error:', err);
      setCameraError(err.message || 'No se pudo iniciar la cámara. Verifica los permisos de acceso a la cámara en tu navegador.');
      setIsScanningActive(false);
      setHasPermission(false);
    }
  };

  // Stop camera scanner
  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanningActive(false);
    setIsTorchOn(false);
  };

  // Effect to manage camera start/stop on tab switch
  useEffect(() => {
    if (isOpen && scannerTab === 'camera') {
      const timer = setTimeout(() => {
        startCameraScanner();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      stopCameraScanner();
    }
  }, [isOpen, scannerTab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  // Torch toggle handler
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanningActive) return;
    try {
      const nextTorch = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Render barcode graphic when matched product changes
  useEffect(() => {
    if (matchedProduct && barcodeSvgRef.current) {
      try {
        const codeToRender = matchedProduct.barcode || matchedProduct.ean || matchedProduct.code || '123456789012';
        const isEan13 = /^\d{13}$/.test(codeToRender.trim());
        const isEan8 = /^\d{8}$/.test(codeToRender.trim());
        const format = isEan13 ? 'EAN13' : isEan8 ? 'EAN8' : 'CODE128';

        JsBarcode(barcodeSvgRef.current, codeToRender, {
          format,
          lineColor: '#1e293b',
          width: 1.8,
          height: 48,
          displayValue: true,
          fontSize: 12,
          fontOptions: 'bold',
          margin: 6,
          background: '#ffffff',
        });
      } catch (err) {
        // Fallback to Code 128
        try {
          if (barcodeSvgRef.current) {
            JsBarcode(barcodeSvgRef.current, matchedProduct.code, {
              format: 'CODE128',
              lineColor: '#1e293b',
              width: 1.6,
              height: 44,
              displayValue: true,
              fontSize: 11,
              margin: 4,
            });
          }
        } catch (e) {}
      }
    }
  }, [matchedProduct]);

  // Handle file scan upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      let html5QrCode = html5QrCodeRef.current;
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode('file-scanner-temp-zone', { verbose: false });
        html5QrCodeRef.current = html5QrCode;
      }

      const decodedText = await html5QrCode.scanFile(file, false);
      handleBarcodeDetected(decodedText);
    } catch (err: any) {
      if (soundEnabled) playBeep('error');
      setCameraError('No se detectó ningún código de barras válido en la imagen cargada. Prueba con una foto más clara o enfoque cercano.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Manual lookup
  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualInput.trim()) return;
    handleBarcodeDetected(manualInput.trim());
  };

  // Quick In-Modal Stock Adjustment
  const handleQuickAdjust = (type: 'in' | 'out', delta: number) => {
    if (!matchedProduct) return;
    const finalDelta = type === 'in' ? Math.abs(delta) : -Math.abs(delta);
    onAdjustStock(matchedProduct.id, finalDelta, adjustReason);

    // Update local product stock view immediately
    const updatedStock = Math.max(0, matchedProduct.stock + finalDelta);
    setMatchedProduct({
      ...matchedProduct,
      stock: updatedStock,
    });

    setJustAdjusted(true);
    if (soundEnabled) playBeep('click');

    setTimeout(() => {
      setJustAdjusted(false);
    }, 2000);
  };

  // Copy code to clipboard
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    if (soundEnabled) playBeep('click');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Export Scan Session to CSV
  const handleExportHistoryCSV = () => {
    if (scanHistory.length === 0) return;
    const rows = [
      ['AUDITORÍA Y REGISTRO DE ESCANEO DE CÓDIGOS DE BARRAS / SKU'],
      ['Fecha', new Date().toLocaleString('es-VE')],
      ['Total Códigos Escaneados', scanHistory.length],
      [],
      ['Hora', 'Código / Barcode', 'Tipo de Coincidencia', 'SKU', 'Producto', 'Categoría', 'Stock Actual', 'Precio USD', 'Precio Bs'],
      ...scanHistory.map((item) => [
        item.timestamp.toLocaleTimeString('es-VE'),
        item.code,
        item.matchType,
        item.matchedProduct?.code || 'N/A',
        item.matchedProduct?.name || 'PRODUCTO NO REGISTRADO',
        item.matchedProduct?.category || 'N/A',
        item.matchedProduct?.stock ?? 'N/A',
        item.matchedProduct ? formatPlainNumber(item.matchedProduct.priceUSD, 2) : 'N/A',
        item.matchedProduct ? formatPlainNumber(item.matchedProduct.priceUSD * settings.bcvRate, 2) : 'N/A',
      ]),
    ];
    exportToCSV(`Auditoria_Escaneo_${new Date().toISOString().split('T')[0]}`, rows);
  };

  // Sample codes from catalog for 1-click testing
  const sampleCatalogCodes = useMemo(() => {
    return products.slice(0, 6).map((p) => ({
      code: p.barcode || p.code,
      sku: p.code,
      name: p.name,
      category: p.category,
    }));
  }, [products]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Hidden temp element for file scanning */}
        <div id="file-scanner-temp-zone" className="hidden" />

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-900/50">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">
                  Lector de Código de Barras y SKU
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  EAN-13 / SKU / QR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Escaneo en vivo con cámara, búsqueda instantánea en inventario y ajuste de stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 text-indigo-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-800/50 text-slate-500 border-slate-800 hover:bg-slate-800'
              }`}
              title={soundEnabled ? 'Sonido activado (Bips)' : 'Sonido silenciado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-100 border-b border-slate-200 shrink-0 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setScannerTab('camera')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                scannerTab === 'camera'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cámara en Vivo</span>
            </button>

            <button
              onClick={() => setScannerTab('manual')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                scannerTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Búsqueda Manual / Muestras</span>
            </button>

            <button
              onClick={() => {
                setScannerTab('file');
                fileInputRef.current?.click();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                scannerTab === 'file'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Escanear desde Foto / Archivo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Mode selection: Single vs Continuous */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300">
              <button
                onClick={() => setScanMode('single')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  scanMode === 'single'
                    ? 'bg-indigo-100 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Detiene el escaneo para revisar la ficha y ajustar stock con calma"
              >
                Modo Consulta
              </button>
              <button
                onClick={() => setScanMode('continuous')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  scanMode === 'continuous'
                    ? 'bg-indigo-100 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Permite escanear artículos seguidos registrando una auditoría continua"
              >
                Auditoría Continua
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
          
          {/* Left Column: Viewfinder & Scanning Controls (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            
            {/* Camera Viewfinder Card */}
            {scannerTab === 'camera' && (
              <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 shadow-lg text-white relative flex flex-col overflow-hidden">
                
                {/* Viewfinder Top Bar */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Lector Óptico Activo</span>
                  </div>

                  {cameras.length > 1 && (
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedCameraId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSelectedCameraId(newId);
                          startCameraScanner(newId);
                        }}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-1 focus:outline-hidden"
                      >
                        {cameras.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label || `Cámara ${c.id.slice(0, 5)}...`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {hasTorchCapability && (
                    <button
                      onClick={handleToggleTorch}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
                        isTorchOn
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      <span>{isTorchOn ? 'Luz ON' : 'Flash'}</span>
                    </button>
                  )}
                </div>

                {/* Viewport Container for html5-qrcode */}
                <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
                  <div id={readerElementId} className="w-full h-full object-cover" />

                  {/* Scanning Guide Overlay with Laser Animation */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Targeting Reticle */}
                    <div className="relative w-4/5 h-3/5 border-2 border-dashed border-indigo-400/60 rounded-xl flex items-center justify-center">
                      {/* Red/Indigo Laser Line Scan Animation */}
                      <div className="absolute inset-x-0 h-0.5 bg-linear-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-bounce" />
                      
                      {/* Corner Target Brackets */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>

                  {/* Status Overlay */}
                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                      <p className="text-xs font-semibold text-white mb-1">Acceso a Cámara no Disponible</p>
                      <p className="text-[11px] text-slate-400 mb-3 max-w-xs">{cameraError}</p>
                      <button
                        onClick={() => startCameraScanner()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Reintentar Conexión
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-indigo-400" />
                    Centra el código de barras en el visor
                  </span>
                  <button
                    onClick={() => {
                      setCurrentScannedCode('');
                      setMatchedProduct(null);
                    }}
                    className="text-indigo-400 hover:underline cursor-pointer"
                  >
                    Limpiar visor
                  </button>
                </div>
              </div>
            )}

            {/* Manual & Sample Code Input View */}
            {(scannerTab === 'manual' || scannerTab === 'file') && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Búsqueda Directa por SKU o Código de Barras EAN
                  </label>
                  <form onSubmit={handleManualSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Ej. ALM-HAR-001 ó 7591001000018..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                    >
                      Buscar
                    </button>
                  </form>
                </div>

                {scannerTab === 'file' && (
                  <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center hover:bg-indigo-50/40 transition">
                    <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-800 mb-0.5">Carga una foto de la etiqueta</p>
                    <p className="text-[11px] text-slate-500 mb-2">JPG, PNG, WebP con código de barras legible</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                    >
                      Seleccionar Imagen
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Códigos de Prueba del Catálogo (1 Clic):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {sampleCatalogCodes.map((s) => (
                      <button
                        key={s.code}
                        onClick={() => {
                          setManualInput(s.code);
                          handleBarcodeDetected(s.code);
                        }}
                        className="text-left px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-[11px] text-slate-700 transition cursor-pointer group"
                      >
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600">{s.sku}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{s.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Tips Box */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Compatibilidad Integral</span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                Este lector reconoce automáticamente códigos <strong>EAN-13, EAN-8, Code 128</strong>, SKU internos y códigos de barras de bultos/presentaciones.
              </p>
            </div>

          </div>

          {/* Right Column: Scanned Product Lookup Card & Quick Actions (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* MATCHED PRODUCT CARD */}
            {matchedProduct ? (
              <div className="bg-white rounded-2xl border-2 border-indigo-500 shadow-md p-5 relative overflow-hidden transition-all">
                
                {/* Header Badge */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Producto Identificado
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {matchedDetail.info}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyCode(matchedProduct.code)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer"
                      title="Copiar código SKU"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{copiedCode ? 'Copiado' : 'SKU'}</span>
                    </button>
                  </div>
                </div>

                {/* Product Core Info Banner */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                    <img
                      src={matchedProduct.image}
                      alt={matchedProduct.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-xs font-mono font-bold">
                        SKU: {matchedProduct.code}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-semibold border border-indigo-100">
                        {matchedProduct.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        Unidad: <strong>{matchedProduct.unit}</strong>
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                      {matchedProduct.name}
                    </h4>

                    {matchedProduct.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {matchedProduct.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Barcode Graphic Visualizer */}
                <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Código de Barras Oficial
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {matchedProduct.barcode || matchedProduct.ean || matchedProduct.code}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                    <svg ref={barcodeSvgRef} className="max-h-12 max-w-full" />
                  </div>
                </div>

                {/* Stock & Financials Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
                  {/* Stock Level Box */}
                  <div className={`p-2.5 rounded-xl border ${
                    matchedProduct.stock <= 0
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : matchedProduct.stock <= matchedProduct.minStock
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      Stock en Almacén
                    </div>
                    <div className="text-lg font-black mt-0.5 flex items-baseline gap-1">
                      <span>{matchedProduct.stock}</span>
                      <span className="text-xs font-normal opacity-70">{matchedProduct.unit}</span>
                    </div>
                    <div className="text-[10px] mt-0.5 font-semibold">
                      {matchedProduct.stock <= 0
                        ? '❌ Agotado'
                        : matchedProduct.stock <= matchedProduct.minStock
                        ? `⚠️ Bajo (Mín: ${matchedProduct.minStock})`
                        : '✔ Existencia Óptima'}
                    </div>
                  </div>

                  {/* Sale Price USD */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Precio de Venta USD
                    </div>
                    <div className="text-lg font-black text-indigo-600 mt-0.5">
                      {formatUSD(matchedProduct.priceUSD)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Costo: {formatUSD(matchedProduct.costUSD)}
                    </div>
                  </div>

                  {/* Sale Price Bs (BCV) */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Precio en Bolívares
                    </div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {formatBs(matchedProduct.priceUSD * settings.bcvRate)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Tasa: {formatPlainNumber(settings.bcvRate, 2)} Bs/$
                    </div>
                  </div>

                  {/* Profit & Margin */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Margen de Ganancia
                    </div>
                    <div className="text-base font-black text-emerald-600 mt-0.5">
                      +{formatPlainNumber(
                        matchedProduct.costUSD > 0
                          ? ((matchedProduct.priceUSD - matchedProduct.costUSD) / matchedProduct.costUSD) * 100
                          : 0,
                        1
                      )}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Utilidad: +{formatUSD(Math.max(0, matchedProduct.priceUSD - matchedProduct.costUSD))}
                    </div>
                  </div>
                </div>

                {/* Presentations list if any */}
                {matchedProduct.presentations && matchedProduct.presentations.length > 0 && (
                  <div className="my-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Presentaciones Disponibles ({matchedProduct.presentations.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchedProduct.presentations.map((pres) => (
                        <div key={pres.id} className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{pres.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Código: {pres.barcode || 'Igual al SKU'} (x{pres.factor} un)
                            </div>
                          </div>
                          <div className="font-black text-indigo-600 text-right">
                            {formatUSD(pres.priceUSD)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* IN-MODAL QUICK STOCK ADJUSTMENT TOOLBAR */}
                <div className="mt-4 pt-3 border-t border-slate-200 bg-indigo-50/50 -mx-5 -mb-5 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-indigo-600" />
                      <span>Ajuste Rápido de Inventario (Kardex)</span>
                    </span>
                    {justAdjusted && (
                      <span className="text-xs font-bold text-emerald-600 animate-fade-in flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ¡Stock Actualizado en Tiempo Real!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    {/* Reason Selector */}
                    <div className="sm:col-span-5">
                      <select
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        className="w-full text-xs bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        <option value="Entrada por reposición física">Entrada por reposición física</option>
                        <option value="Entrada por compra a proveedor">Entrada por compra a proveedor</option>
                        <option value="Ajuste por conteo de auditoría">Ajuste por conteo de auditoría</option>
                        <option value="Salida por merma o rotura">Salida por merma o rotura</option>
                        <option value="Salida por venta rápida">Salida por venta rápida</option>
                      </select>
                    </div>

                    {/* Quantity Stepper & Action Buttons */}
                    <div className="sm:col-span-7 flex items-center gap-1.5 justify-end">
                      <div className="flex items-center bg-white rounded-xl border border-indigo-200 p-0.5 shadow-2xs">
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          value={adjustQty}
                          onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 text-center text-xs font-bold text-slate-900 border-0 focus:ring-0 py-1"
                        />
                        <span className="text-[10px] text-slate-400 pr-2">{matchedProduct.unit}</span>
                      </div>

                      <button
                        onClick={() => handleQuickAdjust('in', adjustQty)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Sumar stock al inventario"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Entrada (+{adjustQty})</span>
                      </button>

                      <button
                        onClick={() => handleQuickAdjust('out', adjustQty)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Restar stock al inventario"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span>Salida (-{adjustQty})</span>
                      </button>
                    </div>
                  </div>

                  {/* Secondary Quick Jump Buttons */}
                  <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {onEditProduct && (
                        <button
                          onClick={() => {
                            onClose();
                            onEditProduct(matchedProduct);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Editar Ficha Completa</span>
                        </button>
                      )}

                      {onOpenBarcodeLabels && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenBarcodeLabels(matchedProduct);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Imprimir Etiqueta</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setCurrentScannedCode('');
                        setMatchedProduct(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <span>Siguiente Escaneo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ) : currentScannedCode ? (
              /* CODE SCANNED BUT NOT IN DATABASE */
              <div className="bg-rose-50/70 border-2 border-rose-300 rounded-2xl p-6 text-center shadow-xs">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-2" />
                <h4 className="text-base font-extrabold text-rose-950 mb-1">
                  Código no encontrado en el inventario
                </h4>
                <div className="inline-block font-mono font-bold text-sm bg-white px-3 py-1 rounded-lg border border-rose-200 text-rose-800 my-2">
                  {currentScannedCode}
                </div>
                <p className="text-xs text-rose-700 max-w-md mx-auto mb-4">
                  El código de barras escaneado no coincide con ningún SKU, código EAN-13, presentación ni proveedor registrado actualmente.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentScannedCode('');
                      setMatchedProduct(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Escanear Otro Código
                  </button>
                </div>
              </div>
            ) : (
              /* AWAITING SCAN PLACEHOLDER */
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center min-h-[340px]">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Barcode className="w-8 h-8 animate-pulse" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Esperando Lectura de Código
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Apunta la cámara de tu dispositivo hacia cualquier etiqueta con código de barras o ingresa el SKU para consultar existencias y precios al instante.
                </p>
              </div>
            )}

            {/* SESSION AUDIT / SCAN HISTORY ACCORDION */}
            {scanHistory.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Historial de Escaneos de la Sesión ({scanHistory.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportHistoryCSV}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Exportar Auditoría CSV</span>
                    </button>
                    <button
                      onClick={() => setScanHistory([])}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-50">
                  {scanHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.matchedProduct) {
                          setMatchedProduct(item.matchedProduct);
                          setCurrentScannedCode(item.code);
                          setMatchedDetail({
                            type: item.matchType,
                            info: `Cargado desde historial: ${item.code}`,
                          });
                        }
                      }}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                        item.matchedProduct ? 'hover:bg-indigo-50/60 bg-slate-50/50' : 'bg-rose-50/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
                          {item.code}
                        </span>
                        <span className="truncate font-semibold text-slate-800">
                          {item.matchedProduct ? item.matchedProduct.name : 'No registrado'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px]">
                        {item.matchedProduct && (
                          <span className="font-black text-indigo-600">
                            Stock: {item.matchedProduct.stock} {item.matchedProduct.unit}
                          </span>
                        )}
                        <span className="text-slate-400">
                          {item.timestamp.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-100 border-t border-slate-200 shrink-0 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span>Módulo de Inventario ERP • La Gran Bodega M&S</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cerrar Escáner
          </button>
        </div>

      </div>
    </div>
  );
};
