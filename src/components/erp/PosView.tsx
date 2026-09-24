import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { Product, PaymentMethod, PaymentSplit, ProductPresentation } from '../../types';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Building2,
  Smartphone,
  Printer,
  CheckCircle,
  CheckCircle2,
  UserCheck,
  AlertCircle,
  Banknote,
  Fingerprint,
  Scale,
  Wine,
  Layers,
  Wifi,
  WifiOff,
  Database,
  Save,
  Barcode,
  Zap,
  Volume2,
  X,
  Sparkles,
  Camera,
  Calculator,
} from 'lucide-react';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { playNotificationSound } from '../../utils/notificationSound';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { PaymentCalculatorModal } from './PaymentCalculatorModal';

interface PosTicketItem {
  id: string;
  product: Product;
  quantity: number;
  selectedPresentation?: ProductPresentation;
  saleMode?: 'standard' | 'presentation' | 'weight' | 'custom_amount';
  weightKg?: number;
  customAmountBs?: number;
  customAmountUSD?: number;
  unitPriceUSD?: number;
  customNote?: string;
}

export const PosView: React.FC = () => {
  const {
    products,
    customers,
    settings,
    createOrder,
    setSelectedInvoiceForModal,
    openPresentationModal,
  } = useApp();

  const isOnline = useOnlineStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Load active ticket items from local storage to survive offline reloads
  const [ticketItems, setTicketItems] = useState<PosTicketItem[]>(() => {
    try {
      const saved = localStorage.getItem('omni_pos_ticket');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync ticket items to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem('omni_pos_ticket', JSON.stringify(ticketItems));
    } catch (e) {
      console.warn('Error al guardar ticket de caja en caché local:', e);
    }
  }, [ticketItems]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo_bs');
  const [customCreditDays, setCustomCreditDays] = useState<number>(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentCalculator, setShowPaymentCalculator] = useState(false);

  // Barcode Scanner state & visual feedback
  const [scanFeedback, setScanFeedback] = useState<{
    id: string;
    type: 'success' | 'error';
    title: string;
    message: string;
    productName?: string;
    productCode?: string;
    productPriceUSD?: number;
    productImage?: string;
  } | null>(null);
  const [isScannerTestOpen, setIsScannerTestOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [testBarcodeInput, setTestBarcodeInput] = useState('');
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');

  const handleManualBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const codeToProcess = manualBarcodeInput.trim();
    if (!codeToProcess) return;
    handleBarcodeScanned(codeToProcess);
    setManualBarcodeInput('');
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  const categories = useMemo(() => {
    const cats = ['Todos'];
    products.forEach((p) => {
      if (!cats.includes(p.category)) cats.push(p.category);
    });
    return cats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const getItemUnitPriceUSD = (item: PosTicketItem): number => {
    if (item.unitPriceUSD !== undefined) {
      return item.unitPriceUSD;
    }
    if (item.saleMode === 'presentation' && item.selectedPresentation) {
      return item.selectedPresentation.priceUSD;
    }
    if (item.saleMode === 'weight' && item.weightKg) {
      const rate = item.product.pricePerKgUSD || item.product.priceUSD;
      return rate * item.weightKg;
    }
    if (item.saleMode === 'custom_amount' && item.customAmountUSD) {
      return item.customAmountUSD;
    }
    return item.product.priceUSD;
  };

  const getItemSubtotalUSD = (item: PosTicketItem): number => {
    if (item.saleMode === 'weight' || item.saleMode === 'custom_amount') {
      return getItemUnitPriceUSD(item);
    }
    return getItemUnitPriceUSD(item) * item.quantity;
  };

  /**
   * Barcode scanner capture handler: searches by product code, id, presentation barcode or supplier barcode,
   * and automatically adds the scanned item to the cart/ticket.
   */
  const handleBarcodeScanned = useCallback(
    (rawBarcode: string) => {
      const clean = rawBarcode.trim();
      if (!clean) return;

      const cleanLower = clean.toLowerCase();

      // Find matching product
      let matchedPresentation: ProductPresentation | undefined;
      const matchedProduct = products.find((p) => {
        if (p.code && p.code.toLowerCase() === cleanLower) return true;
        if (p.id && p.id.toLowerCase() === cleanLower) return true;

        // Match barcode in presentations
        const pres = p.presentations?.find(
          (pr) => pr.barcode && pr.barcode.toLowerCase() === cleanLower
        );
        if (pres) {
          matchedPresentation = pres;
          return true;
        }

        // Match barcode in supplier info
        const supp = p.suppliersInfo?.find(
          (s) => s.barcode && s.barcode.toLowerCase() === cleanLower
        );
        if (supp) return true;

        return false;
      });

      if (!matchedProduct) {
        playNotificationSound('scanner_error');
        const feedbackId = `fb-${Date.now()}`;
        setScanFeedback({
          id: feedbackId,
          type: 'error',
          title: 'Código No Registrado',
          message: `El código de barras "${clean}" no coincide con ningún producto.`,
        });
        setTimeout(() => {
          setScanFeedback((prev) => (prev?.id === feedbackId ? null : prev));
        }, 3500);
        return;
      }

      // Check stock
      if (matchedProduct.stock <= 0) {
        playNotificationSound('scanner_error');
        const feedbackId = `fb-${Date.now()}`;
        setScanFeedback({
          id: feedbackId,
          type: 'error',
          title: 'Producto Agotado',
          message: `${matchedProduct.name} no tiene existencias disponibles en inventario.`,
          productName: matchedProduct.name,
          productCode: matchedProduct.code,
        });
        setTimeout(() => {
          setScanFeedback((prev) => (prev?.id === feedbackId ? null : prev));
        }, 3500);
        return;
      }

      // If matched a specific presentation
      if (matchedPresentation) {
        setTicketItems((prev) => {
          const existing = prev.find(
            (i) =>
              i.product.id === matchedProduct.id &&
              i.saleMode === 'presentation' &&
              i.selectedPresentation?.id === matchedPresentation!.id
          );
          if (existing) {
            return prev.map((item) =>
              item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
            );
          }
          return [
            ...prev,
            {
              id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              product: matchedProduct,
              quantity: 1,
              selectedPresentation: matchedPresentation,
              saleMode: 'presentation',
              unitPriceUSD: matchedPresentation!.priceUSD,
            },
          ];
        });

        playNotificationSound('scanner');
        const feedbackId = `fb-${Date.now()}`;
        setScanFeedback({
          id: feedbackId,
          type: 'success',
          title: '⚡ Presentación Escaneada',
          message: `Añadido: ${matchedPresentation.name} al ticket (+1)`,
          productName: matchedProduct.name,
          productCode: matchedPresentation.barcode || matchedProduct.code,
          productPriceUSD: matchedPresentation.priceUSD,
          productImage: matchedProduct.image,
        });
        setTimeout(() => {
          setScanFeedback((prev) => (prev?.id === feedbackId ? null : prev));
        }, 3000);
      } else {
        // Standard item or check if weighable modal required
        const isWeighableItem = Boolean(matchedProduct.isWeighable || matchedProduct.isFractionable);

        if (isWeighableItem) {
          openPresentationModal(matchedProduct, (result) => {
            setTicketItems((prev) => [
              ...prev,
              {
                id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                product: result.product,
                quantity: result.quantity,
                selectedPresentation: result.presentation,
                saleMode: result.saleMode,
                weightKg: result.weightKg,
                customAmountBs: result.customAmountBs,
                customAmountUSD: result.customAmountUSD,
                unitPriceUSD: result.unitPriceUSD,
                customNote: result.customNote,
              },
            ]);
            playNotificationSound('scanner');
          });

          const feedbackId = `fb-${Date.now()}`;
          setScanFeedback({
            id: feedbackId,
            type: 'success',
            title: '⚡ Balanza / Modal Abierto',
            message: `Ingrese peso o porción para ${matchedProduct.name}`,
            productName: matchedProduct.name,
            productCode: matchedProduct.code,
            productPriceUSD: matchedProduct.priceUSD,
            productImage: matchedProduct.image,
          });
          setTimeout(() => {
            setScanFeedback((prev) => (prev?.id === feedbackId ? null : prev));
          }, 3000);
        } else {
          // Automatic +1 in ticket
          let reachedMax = false;
          setTicketItems((prev) => {
            const existing = prev.find(
              (i) => i.product.id === matchedProduct.id && (!i.saleMode || i.saleMode === 'standard')
            );
            if (existing) {
              if (existing.quantity >= matchedProduct.stock) {
                reachedMax = true;
                return prev;
              }
              return prev.map((item) =>
                item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
              );
            }
            return [
              ...prev,
              {
                id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                product: matchedProduct,
                quantity: 1,
                saleMode: 'standard',
                unitPriceUSD: matchedProduct.priceUSD,
              },
            ];
          });

          if (reachedMax) {
            playNotificationSound('scanner_error');
            const feedbackId = `fb-${Date.now()}`;
            setScanFeedback({
              id: feedbackId,
              type: 'error',
              title: 'Stock Máximo en Ticket',
              message: `Ya se alcanzó el stock total de ${matchedProduct.stock} unidades para este producto.`,
              productName: matchedProduct.name,
              productCode: matchedProduct.code,
            });
            setTimeout(() => {
              setScanFeedback((prev) => (prev?.id === feedbackId ? null : prev));
            }, 3000);
            return;
          }

          playNotificationSound('scanner');
          const feedbackId = `fb-${Date.now()}`;
          setScanFeedback({
            id: feedbackId,
            type: 'success',
            title: '⚡ ¡Producto Escaneado!',
            message: `Añadido al ticket (+1 unidad)`,
            productName: matchedProduct.name,
            productCode: matchedProduct.code,
            productPriceUSD: matchedProduct.priceUSD,
            productImage: matchedProduct.image,
          });
          setTimeout(() => {
            setScanFeedback((prev) => (prev?.id === feedbackId ? null : prev));
          }, 3000);
        }
      }

      // Clear search query if it had remnants of scan
      setSearchQuery('');
    },
    [products, openPresentationModal]
  );

  // Register Global Barcode Scanner Keyboard Listener
  const scannerState = useBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: true,
  });

  const handleProductSelect = (product: Product) => {
    if (product.stock <= 0) {
      alert('Producto agotado.');
      return;
    }

    const hasSpecial = Boolean(
      (product.presentations && product.presentations.length > 0) ||
      product.isWeighable ||
      product.isFractionable
    );

    if (hasSpecial) {
      openPresentationModal(product, (result) => {
        setTicketItems((prev) => [
          ...prev,
          {
            id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product: result.product,
            quantity: result.quantity,
            selectedPresentation: result.presentation,
            saleMode: result.saleMode,
            weightKg: result.weightKg,
            customAmountBs: result.customAmountBs,
            customAmountUSD: result.customAmountUSD,
            unitPriceUSD: result.unitPriceUSD,
            customNote: result.customNote,
          },
        ]);
      });
    } else {
      setTicketItems((prev) => {
        const existing = prev.find(
          (i) => i.product.id === product.id && (!i.saleMode || i.saleMode === 'standard')
        );
        if (existing) {
          if (existing.quantity >= product.stock) {
            alert(`Stock insuficiente (${product.stock} disponibles).`);
            return prev;
          }
          return prev.map((item) =>
            item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [
          ...prev,
          {
            id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product,
            quantity: 1,
            saleMode: 'standard',
            unitPriceUSD: product.priceUSD,
          },
        ];
      });
    }
  };

  const updateTicketQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setTicketItems((prev) => prev.filter((item) => item.id !== itemId));
      return;
    }
    setTicketItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          if (quantity > item.product.stock) {
            alert(`Stock máximo disponible: ${item.product.stock}`);
            return item;
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearTicket = () => {
    setTicketItems([]);
    try {
      localStorage.removeItem('omni_pos_ticket');
    } catch {}

  };

  // Ticket totals
  const subtotalUSD = ticketItems.reduce((sum, item) => sum + getItemSubtotalUSD(item), 0);
  const taxUSD = ticketItems.reduce((sum, item) => {
    const itemSubtotal = getItemSubtotalUSD(item);
    const rate = item.product.appliesIva === false ? 0 : (item.product.ivaRate ?? settings.ivaPercentage);
    return sum + itemSubtotal * (rate / 100);
  }, 0);
  const totalUSD = Number((subtotalUSD + taxUSD).toFixed(2));
  const totalBs = Number((totalUSD * settings.bcvRate).toFixed(2));

  // Credit eligibility
  const creditAvailableUSD = selectedCustomer
    ? Math.max(0, selectedCustomer.creditLimitUSD - selectedCustomer.currentDebtUSD)
    : 0;

  const canUseCredit = Boolean(
    selectedCustomer &&
    selectedCustomer.hasCredit &&
    creditAvailableUSD >= totalUSD
  );

  const handleChargeSale = (calculatorData?: {
    payments: Array<PaymentSplit & { currency: 'Bs' | 'USD'; originalAmount: number }>;
    totalPaidUSD: number;
    totalPaidBs: number;
    changeUSD: number;
    changeBs: number;
  }) => {
    if (ticketItems.length === 0) return;

    setIsCameraScannerOpen(false);

    if (paymentMethod === 'credito' && !canUseCredit) {
      alert('El cliente no posee suficiente cupo de crédito para esta venta.');
      return;
    }

    if (paymentMethod !== 'credito' && !calculatorData) {
      setShowPaymentCalculator(true);
      return;
    }

    if (paymentMethod !== 'credito' && (!calculatorData || calculatorData.payments.length === 0)) return;

    setIsProcessing(true);
    try {
      const paymentSplits = calculatorData?.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amountUSD: Number(p.amountUSD.toFixed(6)),
        amountBs: Number(p.amountBs.toFixed(2)),
        reference: p.reference,
        createdAt: p.createdAt || new Date().toISOString(),
      }));

      const selectedMethod: PaymentMethod = paymentMethod === 'credito'
        ? 'credito'
        : paymentSplits && paymentSplits.length > 1
          ? 'mixto'
          : (paymentSplits?.[0]?.method || 'efectivo_bs');

      const { invoice } = createOrder({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerRif: selectedCustomer.rif,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address,
        items: ticketItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          selectedPresentation: item.selectedPresentation,
          saleMode: item.saleMode,
          weightKg: item.weightKg,
          customAmountBs: item.customAmountBs,
          customAmountUSD: item.customAmountUSD,
          unitPriceUSD: item.unitPriceUSD,
          customNote: item.customNote,
        })),
        paymentMethod: selectedMethod,
        paymentSplits,
        paymentReference: paymentSplits?.find((p) => p.reference)?.reference,
        channel: 'pos',
        customCreditDays: paymentMethod === 'credito' ? customCreditDays : undefined,
        notes: 'Venta directa por caja POS. Atendido en mostrador.',
      });

      setSelectedInvoiceForModal(invoice);
      setShowPaymentCalculator(false);
      clearTicket();
    } catch (err) {
      console.error(err);
      alert('Error al registrar la venta.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Product catalog and search (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Offline Resilient Notice */}
          {!isOnline && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Modo Fuera de Línea Activo:</strong> El catálogo, buscador por código y armado de tickets funcionan localmente con almacenamiento PWA sin requerir conexión a internet.
                </span>
              </div>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-black px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wide">
                Caché POS
              </span>
            </div>
          )}

          {/* POS Header Bar with Search, Barcode Scanner HUD, Categories & Connectivity Indicator */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
            
            {/* Top row: Barcode Scanner Live Status Indicator & Offline Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Barcode className="w-4 h-4 text-indigo-600" />
                  <span>Lector de Código de Barras:</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-200 inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    Escuchando pistola / teclado
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {scannerState.scanCount > 0 && (
                  <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                    {scannerState.scanCount} {scannerState.scanCount === 1 ? 'escaneo' : 'escaneos'}
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-xs"
                  title="Abrir cámara trasera para escanear código de barras"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Escanear con Cámara</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsScannerTestOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  title="Simular o probar lectura de códigos de barras"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Probar Lector</span>
                </button>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                  }`}
                  title={isOnline ? 'Conexión a internet estable' : 'Operando con memoria caché local'}
                >
                  {isOnline ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                  )}
                  <span>{isOnline ? 'POS Online' : 'Offline'}</span>
                </span>
              </div>
            </div>

            {/* Scan Feedback Banner */}
            {scanFeedback && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
                  scanFeedback.type === 'success'
                    ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300'
                    : 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {scanFeedback.productImage ? (
                    <img
                      src={scanFeedback.productImage}
                      alt=""
                      className="w-10 h-10 object-cover rounded-lg bg-white/20 shrink-0 border border-white/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                      {scanFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-white" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded">
                        {scanFeedback.title}
                      </span>
                      {scanFeedback.productCode && (
                        <span className="text-[11px] font-mono bg-white/20 px-1.5 py-0.5 rounded font-bold">
                          {scanFeedback.productCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold mt-0.5 truncate text-white/95">
                      {scanFeedback.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {scanFeedback.productPriceUSD !== undefined && (
                    <span className="text-xs font-extrabold bg-white text-emerald-800 px-2.5 py-1 rounded-lg shadow-xs">
                      ${scanFeedback.productPriceUSD.toFixed(2)} USD
                    </span>
                  )}
                  <button
                    onClick={() => setScanFeedback(null)}
                    className="p-1 hover:bg-white/20 rounded-md transition text-white/80 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Dedicated Manual Barcode Search / Entry Bar */}
            <form
              onSubmit={handleManualBarcodeSubmit}
              className="p-3 bg-slate-50/80 rounded-xl border border-indigo-100 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-indigo-600" />
                  <span>Ingreso Manual de Código de Barras</span>
                </label>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-md">
                  Para etiquetas dañadas o sin lector
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualBarcodeInput}
                    onChange={(e) => setManualBarcodeInput(e.target.value)}
                    placeholder="Escribe el código de barras (ej. ALM-HAR-001 o código EAN)..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!manualBarcodeInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Cargar al Ticket (Enter)</span>
                </button>
              </div>
            </form>

            {/* Catalog Filter / Name Search Input and Categories */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar producto por nombre o filtrar catálogo..."
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-400 font-medium"
                />
              </div>
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 no-scrollbar border-t border-slate-100 pt-2.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const priceBs = p.priceUSD * settings.bcvRate;
              const isOut = p.stock <= 0;
              const hasSpecial = Boolean(
                (p.presentations && p.presentations.length > 0) ||
                p.isWeighable ||
                p.isFractionable
              );

              return (
                <button
                  key={p.id}
                  onClick={() => !isOut && handleProductSelect(p)}
                  disabled={isOut}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition group relative ${
                    isOut
                      ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-100 mb-2">
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-600 font-semibold">{p.code}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          p.stock <= p.minStock ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        Stock: {p.stock}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 mt-1 leading-snug">
                      {p.name}
                    </h4>

                    {/* Special sale badges */}
                    {hasSpecial && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.isWeighable && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Scale className="w-2.5 h-2.5 text-emerald-600" /> Balanza: {formatUSD(p.pricePerKgUSD || p.priceUSD)}/Kg
                          </span>
                        )}
                        {p.isFractionable && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            <Wine className="w-2.5 h-2.5 text-purple-600" /> Monto Libre Bs
                          </span>
                        )}
                        {p.presentations && p.presentations.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            <Layers className="w-2.5 h-2.5 text-blue-600" /> {p.presentations.length} Pres.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-sm font-extrabold text-indigo-700 font-mono">
                      {formatUSD(p.priceUSD)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-700 font-semibold">
                      {formatBs(priceBs)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Active POS Ticket & Payment (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col justify-between space-y-4">
          
          <div>
            {/* Ticket Header & Customer Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Ticket de Venta Caja</h3>
                  {ticketItems.length > 0 && (
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <Save className="w-2.5 h-2.5" /> Guardado en caché ({ticketItems.length} {ticketItems.length === 1 ? 'ítem' : 'ítems'})
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={clearTicket}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
              >
                Limpiar
              </button>
            </div>

            {/* Customer selector with Credit info */}
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                <span>Cliente Receptor de Factura:</span>
                <span className="text-[10px] font-mono text-slate-400">RIF: {selectedCustomer?.rif}</span>
              </label>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.hasCredit ? `[Crédito: ${c.creditDays}d - Límite: $${c.creditLimitUSD}]` : '[Contado]'}
                  </option>
                ))}
              </select>

              {selectedCustomer?.hasCredit && (
                <div className="mt-2 text-[11px] text-emerald-700 font-medium flex items-center justify-between">
                  <span>Plazo de Crédito: {selectedCustomer.creditDays} días</span>
                  <span>Cupo disponible: ${creditAvailableUSD.toFixed(2)} USD</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mt-3 max-h-52 overflow-y-auto divide-y divide-slate-100 pr-1">
              {ticketItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Haga clic en los productos para agregarlos al ticket.
                </div>
              ) : (
                ticketItems.map((item) => {
                  const itemSubtotalUSD = getItemSubtotalUSD(item);
                  const itemSubtotalBs = itemSubtotalUSD * settings.bcvRate;

                  return (
                    <div key={item.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-800 truncate">{item.product.name}</p>
                          {item.saleMode === 'weight' && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              <Scale className="w-2.5 h-2.5" /> Peso
                            </span>
                          )}
                          {item.saleMode === 'custom_amount' && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-800">
                              <Wine className="w-2.5 h-2.5" /> Fraccionado
                            </span>
                          )}
                          {item.saleMode === 'presentation' && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-800">
                              <Layers className="w-2.5 h-2.5" /> Pres.
                            </span>
                          )}
                        </div>

                        {item.saleMode === 'presentation' && item.selectedPresentation && (
                          <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                            {item.selectedPresentation.name} ({item.selectedPresentation.factor} un.) @ {formatUSD(item.selectedPresentation.priceUSD)}
                          </p>
                        )}

                        {item.saleMode === 'weight' && (
                          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                            Balanza: {item.weightKg} Kg ({Math.round((item.weightKg || 0) * 1000)}g) @ {formatUSD(item.product.pricePerKgUSD || item.product.priceUSD)}/Kg
                          </p>
                        )}

                        {item.saleMode === 'custom_amount' && (
                          <p className="text-[11px] text-purple-700 font-medium mt-0.5">
                            Monto libre: {formatBs(item.customAmountBs || 0)} ({formatUSD(item.customAmountUSD || 0)}) &rarr; Cantidad: {item.quantity} {item.product.fractionUnit || item.product.unit || 'L'}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                          <span>Subtotal: <strong className="text-slate-700">{formatUSD(itemSubtotalUSD)}</strong></span>
                          <span>({formatBs(itemSubtotalBs)})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        {item.saleMode !== 'weight' && item.saleMode !== 'custom_amount' && (
                          <>
                            <button
                              onClick={() => updateTicketQuantity(item.id, item.quantity - 1)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-mono font-bold text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateTicketQuantity(item.id, item.quantity + 1)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => updateTicketQuantity(item.id, 0)}
                          className="p-1 text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                          title="Quitar ítem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Totals & Payment Checkout */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            {/* Totals Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Base Imponible:</span>
                <span className="font-mono font-medium">{formatUSD(subtotalUSD)} USD</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IVA ({settings.ivaPercentage}%):</span>
                <span className="font-mono font-medium">{formatUSD(taxUSD)} USD</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-slate-200">
                <span>Total Factura:</span>
                <span className="font-mono text-indigo-700">{formatUSD(totalUSD)} USD</span>
              </div>
              <div className="flex justify-between font-bold text-sm bg-emerald-50 text-emerald-800 p-2 rounded-lg">
                <span>Total en Bolívares (BCV):</span>
                <span className="font-mono">
                  {formatBs(totalBs)}
                </span>
              </div>
            </div>

            {/* Cobro: calculadora centralizada */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-slate-800">Cobro de la venta</p>
                  <p className="text-[10px] text-slate-500">El cajero registra uno o varios medios dentro de una sola calculadora.</p>
                </div>
                <Calculator className="w-5 h-5 text-indigo-600 shrink-0" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('efectivo_bs');
                  setShowPaymentCalculator(true);
                }}
                disabled={ticketItems.length === 0 || isProcessing}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                CALCULADORA DE COBRO — {formatUSD(totalUSD)} / {formatBs(totalBs)}
              </button>
            </div>

            {/* Crédito Comercial permanece como modalidad de venta, no como medio de la calculadora. */}
            <button
              type="button"
              disabled={!canUseCredit || ticketItems.length === 0 || isProcessing}
              onClick={() => {
                setPaymentMethod('credito');
                handleChargeSale();
              }}
              className="w-full h-9 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-black text-[10px] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            >
              A CRÉDITO COMERCIAL
            </button>



          </div>

        </div>

      </div>

      {showPaymentCalculator && (
        <PaymentCalculatorModal
          totalUSD={totalUSD}
          totalBs={totalBs}
          exchangeRate={settings.bcvRate}
          onClose={() => setShowPaymentCalculator(false)}
          onConfirm={(data) => handleChargeSale(data)}
        />
      )}

      {isCameraScannerOpen && (
        <CameraBarcodeScanner
          continuous
          onScan={(code) => {
            // En modo continuo NO cerramos la cámara: cada lectura alimenta
            // el mismo handler del lector USB y suma el producto al ticket.
            handleBarcodeScanned(code);
          }}
          onClose={() => setIsCameraScannerOpen(false)}
        />
      )}

      {/* Barcode Scanner Test & Diagnostic Modal */}
      {isScannerTestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Barcode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Lector de Código de Barras POS
                  </h3>
                  <p className="text-xs text-slate-500">
                    Disparador de eventos por teclado para pistolas lectoras
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScannerTestOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>¿Cómo funciona el lector en el POS?</span>
                </div>
                <p className="text-indigo-800 leading-relaxed text-[11px]">
                  Cualquier lector de código de barras USB, inalámbrico 2.4G o Bluetooth conectado actúa como un dispositivo de entrada de teclado de alta velocidad. El sistema detecta automáticamente la ráfaga de pulsaciones de teclas y el <strong>Enter</strong> final, agregando el producto al ticket al instante sin necesidad de enfocar campos manualmente.
                </p>
              </div>

              {/* Manual code test input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Probar lectura de código de barras manual:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testBarcodeInput}
                    onChange={(e) => setTestBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && testBarcodeInput.trim()) {
                        e.preventDefault();
                        handleBarcodeScanned(testBarcodeInput.trim());
                        setTestBarcodeInput('');
                        setIsScannerTestOpen(false);
                      }
                    }}
                    placeholder="Ej. ALM-HAR-001 o código EAN..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (testBarcodeInput.trim()) {
                        handleBarcodeScanned(testBarcodeInput.trim());
                        setTestBarcodeInput('');
                        setIsScannerTestOpen(false);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Disparar</span>
                  </button>
                </div>
              </div>

              {/* Sound Tester */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  Prueba de Sonido de Confirmación (Beep POS)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playNotificationSound('scanner')}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold rounded-lg transition cursor-pointer"
                  >
                    Beep Éxito
                  </button>
                  <button
                    type="button"
                    onClick={() => playNotificationSound('scanner_error')}
                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-bold rounded-lg transition cursor-pointer"
                  >
                    Beep Error
                  </button>
                </div>
              </div>

              {/* Quick sample products barcodes */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Códigos rápidos de prueba del catálogo:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {products.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleBarcodeScanned(p.code);
                        setIsScannerTestOpen(false);
                      }}
                      className="p-2 border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-xl text-left transition flex items-center gap-2 group cursor-pointer"
                    >
                      <img
                        src={p.image}
                        alt=""
                        className="w-8 h-8 rounded-md object-cover bg-slate-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-indigo-700 truncate">
                            {p.code}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-800">
                            ${p.priceUSD.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate font-medium">
                          {p.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsScannerTestOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
