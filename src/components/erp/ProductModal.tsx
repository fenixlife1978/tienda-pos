import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Product,
  ProductPresentation,
  ProductSupplierInfo,
  AlternativePrices,
  CompositeComponent,
} from '../../types';
import {
  X,
  Package,
  DollarSign,
  Truck,
  Layers,
  Camera,
  Upload,
  Percent,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Eye,
  Info,
  Boxes,
  Barcode,
  ShoppingBag,
  ShieldCheck,
  SwitchCamera,
  Image as ImageIcon,
} from 'lucide-react';
import {
  formatUSD,
  formatBs,
  formatPlainNumber,
  isValidDecimalInput,
  parseFreeTextInput,
} from '../../utils/formatUtils';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSave: (productData: Omit<Product, 'id'> | Product) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSave,
}) => {
  const { suppliers, products, settings, categories, units, setIsCategoryUnitModalOpen } = useApp();

  // Active sub-tab in modal
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'suppliers' | 'presentations' | 'composite' | 'image'>('general');

  // Form Basic Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Víveres');
  const [unit, setUnit] = useState(units[0]?.name || 'Unidad');
  const [description, setDescription] = useState('');
  const [stockStr, setStockStr] = useState('50');
  const [minStockStr, setMinStockStr] = useState('15');
  const [appliesIva, setAppliesIva] = useState(false); // Selector de I.V.A.

  // Weight-based (Queso, embutidos) & Fractional Bs. (Licor, granel) state
  const [isWeighable, setIsWeighable] = useState(false);
  const [pricePerKgUSDStr, setPricePerKgUSDStr] = useState<string>('');
  const [isFractionable, setIsFractionable] = useState(false);
  const [fractionUnit, setFractionUnit] = useState('Litro');

  // Cost and Pricing State as Free Text (Allows backspacing completely and entering micro-decimals like 0.000034)
  const [costUSDStr, setCostUSDStr] = useState<string>('1.0');
  const [profitMarginPercentStr, setProfitMarginPercentStr] = useState<string>('30');
  const [priceUSDStr, setPriceUSDStr] = useState<string>('1.3');

  // Alternative Prices State (Promoción, Oferta, Gran Mayor)
  const [alternativePrices, setAlternativePrices] = useState<AlternativePrices>({
    promocion: {
      discountPercent: 5,
      finalPriceUSD: 0,
      customerSavingsUSD: 0,
      active: false,
    },
    oferta: {
      discountPercent: 10,
      finalPriceUSD: 0,
      customerSavingsUSD: 0,
      active: false,
    },
    granMayor: {
      discountPercent: 15,
      finalPriceUSD: 0,
      customerSavingsUSD: 0,
      active: false,
    },
  });

  // Alternative discount input strings for free text editing
  const [promoDiscountStr, setPromoDiscountStr] = useState<string>('5');
  const [ofertaDiscountStr, setOfertaDiscountStr] = useState<string>('10');
  const [granMayorDiscountStr, setGranMayorDiscountStr] = useState<string>('15');

  // Presentations State (Tipos y precios)
  const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
  const [newPresName, setNewPresName] = useState('Bulto x 24 un');
  const [newPresFactorStr, setNewPresFactorStr] = useState<string>('24');
  const [newPresPriceUSDStr, setNewPresPriceUSDStr] = useState<string>('');
  const [newPresBarcode, setNewPresBarcode] = useState('');

  // Suppliers State with Highest Cost Rule
  const [suppliersInfo, setSuppliersInfo] = useState<ProductSupplierInfo[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierCostUSDStr, setSupplierCostUSDStr] = useState<string>('1.0');
  const [supplierBarcode, setSupplierBarcode] = useState<string>('');

  // Composite Product State (Kit / Combo)
  const [isComposite, setIsComposite] = useState<boolean>(false);
  const [compositeComponents, setCompositeComponents] = useState<CompositeComponent[]>([]);
  const [selectedComponentProductId, setSelectedComponentProductId] = useState<string>('');
  const [componentQuantityStr, setComponentQuantityStr] = useState<string>('1');

  // Image Upload and Live Camera State
  const [image, setImage] = useState<string>('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load product data when editing or create new
  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setCode(productToEdit.code);
        setName(productToEdit.name);
        setCategory(productToEdit.category || (categories[0]?.name || 'Víveres'));
        setUnit(productToEdit.unit || (units[0]?.name || 'Unidad'));
        setDescription(productToEdit.description || '');
        setStockStr(String(productToEdit.stock ?? 0));
        setMinStockStr(String(productToEdit.minStock ?? 0));
        setAppliesIva(Boolean(productToEdit.appliesIva));

        setIsWeighable(Boolean(productToEdit.isWeighable));
        setPricePerKgUSDStr(
          productToEdit.pricePerKgUSD !== undefined ? formatPlainNumber(productToEdit.pricePerKgUSD, 6) : ''
        );
        setIsFractionable(Boolean(productToEdit.isFractionable));
        setFractionUnit(productToEdit.fractionUnit || 'Litro');

        const cUSD = productToEdit.costUSD ?? 1.0;
        const pUSD = productToEdit.priceUSD ?? 1.3;
        setCostUSDStr(formatPlainNumber(cUSD, 6));
        setPriceUSDStr(formatPlainNumber(pUSD, 6));

        const calcMargin = cUSD > 0 ? ((pUSD - cUSD) / cUSD) * 100 : 30;
        const marginVal = productToEdit.profitMarginPercent ?? calcMargin;
        setProfitMarginPercentStr(formatPlainNumber(marginVal, 2));

        // Alternative prices
        if (productToEdit.alternativePrices) {
          setAlternativePrices(productToEdit.alternativePrices);
          setPromoDiscountStr(String(productToEdit.alternativePrices.promocion?.discountPercent ?? 5));
          setOfertaDiscountStr(String(productToEdit.alternativePrices.oferta?.discountPercent ?? 10));
          setGranMayorDiscountStr(String(productToEdit.alternativePrices.granMayor?.discountPercent ?? 15));
        } else {
          const promoDisc = productToEdit.discountPercentage || 5;
          setPromoDiscountStr(String(promoDisc));
          setOfertaDiscountStr('10');
          setGranMayorDiscountStr('15');

          setAlternativePrices({
            promocion: {
              discountPercent: promoDisc,
              finalPriceUSD: pUSD * (1 - promoDisc / 100),
              customerSavingsUSD: pUSD * (promoDisc / 100),
              active: Boolean(productToEdit.isOffer),
            },
            oferta: {
              discountPercent: 10,
              finalPriceUSD: pUSD * 0.9,
              customerSavingsUSD: pUSD * 0.1,
              active: false,
            },
            granMayor: {
              discountPercent: 15,
              finalPriceUSD: pUSD * 0.85,
              customerSavingsUSD: pUSD * 0.15,
              active: false,
            },
          });
        }

        setPresentations(productToEdit.presentations || []);
        setSuppliersInfo(productToEdit.suppliersInfo || []);

        setIsComposite(Boolean(productToEdit.isComposite));
        setCompositeComponents(productToEdit.compositeComponents || []);

        setImage(productToEdit.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
      } else {
        // New product defaults
        setCode(`SKU-${Math.floor(100000 + Math.random() * 900000)}`);
        setName('');
        setCategory(categories[0]?.name || 'Víveres');
        setUnit(units[0]?.name || 'Unidad');
        setDescription('');
        setStockStr('50');
        setMinStockStr('15');
        setAppliesIva(false);

        const initCost = 1.0;
        const initMargin = 30;
        const initPrice = initCost * (1 + initMargin / 100);
        setCostUSDStr(formatPlainNumber(initCost, 6));
        setProfitMarginPercentStr(formatPlainNumber(initMargin, 2));
        setPriceUSDStr(formatPlainNumber(initPrice, 6));

        setPromoDiscountStr('5');
        setOfertaDiscountStr('10');
        setGranMayorDiscountStr('15');

        setAlternativePrices({
          promocion: {
            discountPercent: 5,
            finalPriceUSD: initPrice * 0.95,
            customerSavingsUSD: initPrice * 0.05,
            active: false,
          },
          oferta: {
            discountPercent: 10,
            finalPriceUSD: initPrice * 0.9,
            customerSavingsUSD: initPrice * 0.1,
            active: false,
          },
          granMayor: {
            discountPercent: 15,
            finalPriceUSD: initPrice * 0.85,
            customerSavingsUSD: initPrice * 0.15,
            active: false,
          },
        });

        setPresentations([]);
        setSuppliersInfo([]);
        setIsComposite(false);
        setCompositeComponents([]);
        setIsWeighable(false);
        setPricePerKgUSDStr('');
        setIsFractionable(false);
        setFractionUnit(units.find(u => u.name.toLowerCase().includes('litro'))?.name || 'Litro');
        setImage('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
      }

      if (suppliers.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(suppliers[0].id);
      }
      setActiveTab('general');
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, productToEdit]);

  // Recalculate Alternative Prices whenever base priceUSD or discountPercent changes
  useEffect(() => {
    const currentBasePrice = parseFreeTextInput(priceUSDStr, 0);
    setAlternativePrices((prev) => {
      const recalc = (discount: number, active: boolean) => {
        const validDiscount = Math.max(0, Math.min(100, discount));
        const finalPriceUSD = currentBasePrice * (1 - validDiscount / 100);
        const customerSavingsUSD = currentBasePrice - finalPriceUSD;
        return {
          discountPercent: validDiscount,
          finalPriceUSD,
          customerSavingsUSD,
          active,
        };
      };

      return {
        promocion: recalc(parseFreeTextInput(promoDiscountStr, 5), prev.promocion.active),
        oferta: recalc(parseFreeTextInput(ofertaDiscountStr, 10), prev.oferta.active),
        granMayor: recalc(parseFreeTextInput(granMayorDiscountStr, 15), prev.granMayor.active),
      };
    });
  }, [priceUSDStr, promoDiscountStr, ofertaDiscountStr, granMayorDiscountStr]);

  // HIGHEST COST RULE AMONG SUPPLIERS:
  // "el sistema siempre tomará para el precio de costo el monto más alto de costo de entre los proveedores"
  const highestSupplierCost = useMemo(() => {
    if (suppliersInfo.length === 0) return null;
    return Math.max(...suppliersInfo.map((s) => s.costUSD));
  }, [suppliersInfo]);

  const highestCostSupplier = useMemo(() => {
    if (suppliersInfo.length === 0) return null;
    return suppliersInfo.reduce((prev, curr) => (curr.costUSD > prev.costUSD ? curr : prev), suppliersInfo[0]);
  }, [suppliersInfo]);

  // Whenever suppliersInfo changes, if there is a highest cost, automatically update costUSD and recalculate price
  useEffect(() => {
    if (highestSupplierCost !== null && highestSupplierCost > 0) {
      setCostUSDStr(formatPlainNumber(highestSupplierCost, 6));
      const margin = parseFreeTextInput(profitMarginPercentStr, 0);
      const newPrice = highestSupplierCost * (1 + margin / 100);
      setPriceUSDStr(formatPlainNumber(newPrice, 6));
    }
  }, [highestSupplierCost]);

  // Cost and Margin bidirectional handlers supporting free-text (e.g., 0.000034)
  const handleCostChange = (rawText: string) => {
    if (!isValidDecimalInput(rawText)) return;
    setCostUSDStr(rawText);
    const costNum = parseFreeTextInput(rawText, 0);
    if (costNum > 0) {
      const marginNum = parseFreeTextInput(profitMarginPercentStr, 0);
      const newPrice = costNum * (1 + marginNum / 100);
      setPriceUSDStr(formatPlainNumber(newPrice, 6));
    }
  };

  const handleMarginChange = (rawText: string) => {
    if (!isValidDecimalInput(rawText)) return;
    setProfitMarginPercentStr(rawText);
    const marginNum = parseFreeTextInput(rawText, 0);
    const costNum = parseFreeTextInput(costUSDStr, 0);
    if (costNum > 0) {
      const newPrice = costNum * (1 + marginNum / 100);
      setPriceUSDStr(formatPlainNumber(newPrice, 6));
    }
  };

  const handlePriceChange = (rawText: string) => {
    if (!isValidDecimalInput(rawText)) return;
    setPriceUSDStr(rawText);
    const priceNum = parseFreeTextInput(rawText, 0);
    const costNum = parseFreeTextInput(costUSDStr, 0);
    if (costNum > 0 && priceNum > 0) {
      const calculatedMargin = ((priceNum - costNum) / costNum) * 100;
      setProfitMarginPercentStr(formatPlainNumber(calculatedMargin, 2));
    }
  };

  const toggleAlternativeActive = (tier: keyof AlternativePrices) => {
    setAlternativePrices((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        active: !prev[tier].active,
      },
    }));
  };

  // Presentations Handlers
  const handleAddPresentation = () => {
    if (!newPresName.trim()) return;
    const factor = Math.max(1, parseInt(newPresFactorStr) || 1);
    const basePrice = parseFreeTextInput(priceUSDStr, 0);
    const customPrice = parseFreeTextInput(newPresPriceUSDStr, 0);
    const suggestedPrice = customPrice > 0 ? customPrice : basePrice * factor * 0.95;

    const newPres: ProductPresentation = {
      id: `pres-${Date.now()}`,
      name: newPresName.trim(),
      factor,
      priceUSD: suggestedPrice,
      barcode: newPresBarcode.trim() || undefined,
    };

    setPresentations((prev) => [...prev, newPres]);
    setNewPresName('');
    setNewPresFactorStr('12');
    setNewPresPriceUSDStr('');
    setNewPresBarcode('');
  };

  const handleDeletePresentation = (id: string) => {
    setPresentations((prev) => prev.filter((p) => p.id !== id));
  };

  // Suppliers Handlers (Highest Cost Rule with high precision)
  const handleAddSupplier = () => {
    if (!selectedSupplierId) return;
    const supp = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supp) return;

    if (suppliersInfo.some((s) => s.supplierId === selectedSupplierId)) {
      alert(`El proveedor ${supp.name} ya está asociado a este producto. Modifícalo o elimínalo primero.`);
      return;
    }

    const suppCost = parseFreeTextInput(supplierCostUSDStr, 0);
    if (suppCost <= 0) {
      alert('Por favor ingrese un costo válido mayor a 0 para el proveedor.');
      return;
    }

    const newSupplierItem: ProductSupplierInfo = {
      id: `prod-sup-${Date.now()}`,
      supplierId: supp.id,
      supplierName: supp.name,
      costUSD: suppCost,
      barcode: supplierBarcode.trim() || code,
    };

    const updatedSuppliers = [...suppliersInfo, newSupplierItem];
    setSuppliersInfo(updatedSuppliers);
    setSupplierBarcode('');
    setSupplierCostUSDStr('1.0');
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliersInfo((prev) => prev.filter((s) => s.id !== id));
  };

  // Composite Product Handlers
  const availableProductsForComposite = useMemo(() => {
    return products.filter((p) => (!productToEdit || p.id !== productToEdit.id) && !p.isComposite);
  }, [products, productToEdit]);

  const handleAddCompositeComponent = () => {
    if (!selectedComponentProductId) return;
    const compProd = products.find((p) => p.id === selectedComponentProductId);
    if (!compProd) return;

    if (compositeComponents.some((c) => c.productId === compProd.id)) {
      alert('Este componente ya está incluido en el combo.');
      return;
    }

    const qty = Math.max(1, parseInt(componentQuantityStr) || 1);
    const newComp: CompositeComponent = {
      productId: compProd.id,
      productName: compProd.name,
      quantity: qty,
      costUSD: compProd.costUSD,
    };

    setCompositeComponents((prev) => [...prev, newComp]);
    setSelectedComponentProductId('');
    setComponentQuantityStr('1');
  };

  const handleDeleteCompositeComponent = (productId: string) => {
    setCompositeComponents((prev) => prev.filter((c) => c.productId !== productId));
  };

  // Composite Total Cost & Virtual Stock
  const compositeTotalCostUSD = useMemo(() => {
    return compositeComponents.reduce((sum, c) => sum + c.costUSD * c.quantity, 0);
  }, [compositeComponents]);

  const compositeVirtualStock = useMemo(() => {
    if (!isComposite || compositeComponents.length === 0) return 0;
    const stocks = compositeComponents.map((c) => {
      const prod = products.find((p) => p.id === c.productId);
      if (!prod) return 0;
      return Math.floor(prod.stock / c.quantity);
    });
    return Math.min(...stocks);
  }, [isComposite, compositeComponents, products]);

  const handleApplyCompositeCost = () => {
    handleCostChange(formatPlainNumber(compositeTotalCostUSD, 6));
  };

  // Image Upload File Handler (from PC / Device)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Live Camera Handlers (Webcam / Mobile Camera)
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Error al acceder a la cámara:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Por favor habilita el permiso en tu navegador.'
          : 'No se pudo inicializar la cámara o no hay dispositivo disponible.'
      );
      setIsCameraActive(false);
    }
  };

  const switchFacingMode = async () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setImage(dataUrl);
      stopCamera();
    }
  };

  // Save product submit (Preserves up to 6 decimal precision)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor ingrese el nombre del producto.');
      setActiveTab('general');
      return;
    }

    const finalCostUSD = parseFreeTextInput(costUSDStr, 0);
    const finalPriceUSD = parseFreeTextInput(priceUSDStr, 0);
    const finalProfitMargin = parseFreeTextInput(profitMarginPercentStr, 0);
    const finalStock = parseInt(stockStr) || 0;
    const finalMinStock = parseInt(minStockStr) || 0;

    if (finalCostUSD <= 0) {
      alert('El precio de costo debe ser mayor a 0 (ej: 0.000034).');
      setActiveTab('pricing');
      return;
    }

    if (finalPriceUSD <= 0) {
      alert('El precio de venta debe ser mayor a 0 (ej: 0.000045).');
      setActiveTab('pricing');
      return;
    }

    const calculatedStock = isComposite && compositeComponents.length > 0 ? compositeVirtualStock : finalStock;
    const finalPricePerKg = isWeighable
      ? (parseFreeTextInput(pricePerKgUSDStr, 0) || finalPriceUSD)
      : undefined;

    const productPayload: Omit<Product, 'id'> = {
      code: code.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      category: category.trim() || 'Víveres',
      unit: unit.trim() || 'Unidad',
      description: description.trim(),
      costUSD: finalCostUSD,
      profitMarginPercent: finalProfitMargin,
      priceUSD: finalPriceUSD,
      stock: calculatedStock,
      minStock: finalMinStock,
      image,
      appliesIva,
      isOffer: alternativePrices.promocion.active || alternativePrices.oferta.active,
      discountPercentage: alternativePrices.oferta.active
        ? alternativePrices.oferta.discountPercent
        : alternativePrices.promocion.active
        ? alternativePrices.promocion.discountPercent
        : 0,
      alternativePrices,
      presentations: presentations.length > 0 ? presentations : undefined,
      suppliersInfo: suppliersInfo.length > 0 ? suppliersInfo : undefined,
      highestSupplierCost: highestSupplierCost ?? undefined,
      isComposite,
      compositeComponents: isComposite ? compositeComponents : undefined,
      compositeVirtualStock: isComposite ? compositeVirtualStock : undefined,
      isWeighable,
      pricePerKgUSD: finalPricePerKg,
      isFractionable,
      fractionUnit: isFractionable ? fractionUnit : undefined,
    };

    if (productToEdit) {
      onSave({
        ...productPayload,
        id: productToEdit.id,
      });
    } else {
      onSave(productPayload);
    }

    onClose();
  };

  if (!isOpen) return null;

  const currentPriceUSDNum = parseFreeTextInput(priceUSDStr, 0);
  const currentCostUSDNum = parseFreeTextInput(costUSDStr, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                {productToEdit ? `Editar Producto: ${productToEdit.name}` : 'Crear Nuevo Producto (Alta Precisión)'}
              </h3>
              <p className="text-xs text-slate-500">
                Soporte de texto libre y montos con hasta 6 decimales (ej. $0.000034 USD)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-white overflow-x-auto no-scrollbar shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            Datos Básicos & Venta Especial
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Costos & Precios (Hasta 6 Decimales)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'suppliers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            Proveedores & Regla Max ({suppliersInfo.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presentations')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'presentations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Presentaciones / Bultos ({presentations.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('composite')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'composite'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Combo / Kit Compuesto {isComposite && `(${compositeComponents.length})`}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'image'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            Fotografía & Cámara
          </button>
        </div>

        {/* Form Body with Scroll */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* ==================== TAB 1: DATOS BÁSICOS & MODALIDADES ==================== */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código / SKU / Barra *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                    placeholder="SKU-100234"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nombre Comercial del Producto *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
                    placeholder="Ej: Harina de Maíz Precocida 1Kg, Queso Blanco Llanero, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Categoría *</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryUnitModalOpen(true)}
                      className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Unidad de Medida Base *</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryUnitModalOpen(true)}
                      className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minStockStr}
                    onChange={(e) => {
                      if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                        setMinStockStr(e.target.value);
                      }
                    }}
                    placeholder="15"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* MODALIDADES ESPECIALES: AL PESO (QUESO) Y MONTO LIBRE (LICOR) */}
              <div className="p-4 bg-gradient-to-r from-amber-50/70 to-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    Modalidades de Venta Avanzada (Al Peso o Fraccionado Libre)
                  </span>
                  <span className="text-[10px] text-slate-500">Caja POS & Tienda Online</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Modalidad 1: Venta al peso (Queso / Balanza) */}
                  <div className={`p-3 rounded-xl border transition ${isWeighable ? 'bg-white border-amber-400 shadow-xs' : 'bg-white/60 border-slate-200'}`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isWeighable}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setIsWeighable(val);
                          if (val && !pricePerKgUSDStr) setPricePerKgUSDStr(priceUSDStr);
                        }}
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-slate-900 text-xs block">
                          ⚖️ Producto para Venta al Peso (Kg / Balanza)
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                          Ej. Quesos, jamones, pollo. En caja solicitará el peso en Kg y calculará el monto exacto según la tasa BCV.
                        </span>
                      </div>
                    </label>

                    {isWeighable && (
                      <div className="mt-2.5 pt-2 border-t border-amber-100 flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-slate-700">Precio por Kg (USD):</label>
                        <div className="relative w-36">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={pricePerKgUSDStr || priceUSDStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setPricePerKgUSDStr(e.target.value);
                              }
                            }}
                            placeholder="0.00"
                            className="w-full pl-6 pr-2 py-1 border border-amber-300 rounded-lg text-xs font-mono font-bold bg-amber-50/50"
                          />
                          <span className="absolute left-2 top-1 text-slate-400 text-xs">$</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modalidad 2: Venta por monto libre en Bs (Licores / Granel) */}
                  <div className={`p-3 rounded-xl border transition ${isFractionable ? 'bg-white border-blue-400 shadow-xs' : 'bg-white/60 border-slate-200'}`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFractionable}
                        onChange={(e) => setIsFractionable(e.target.checked)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-slate-900 text-xs block">
                          🍾 Venta Fraccionada por Monto Libre en Bs.
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                          Ej. Licores por copa/trago o monto disponible. El cliente indica cuántos Bs desea comprar y el sistema determina la cantidad a despachar.
                        </span>
                      </div>
                    </label>

                    {isFractionable && (
                      <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-slate-700">Unidad de despacho:</label>
                        <select
                          value={fractionUnit}
                          onChange={(e) => setFractionUnit(e.target.value)}
                          className="px-2 py-1 border border-blue-300 rounded-lg text-xs bg-blue-50/50 font-medium"
                        >
                          <option value="Litro">Litro / ml</option>
                          <option value="Trago">Trago / Shot</option>
                          <option value="Kg">Kg / Gramos</option>
                          <option value="Porción">Porción / Ración</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Stock Físico en Almacén {!isComposite && '*'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={isComposite}
                    value={isComposite ? String(compositeVirtualStock) : stockStr}
                    onChange={(e) => {
                      if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                        setStockStr(e.target.value);
                      }
                    }}
                    placeholder="50"
                    className={`w-full px-3 py-2 border rounded-xl font-mono font-bold focus:ring-2 focus:ring-indigo-500 ${
                      isComposite
                        ? 'bg-purple-50 text-purple-900 border-purple-300 cursor-not-allowed'
                        : 'border-slate-300'
                    }`}
                  />
                  {isComposite && (
                    <p className="text-[10px] text-purple-700 mt-1 font-semibold">
                      Stock virtual calculado automáticamente según los componentes ({compositeVirtualStock} combos armables).
                    </p>
                  )}
                </div>

                {/* SELECTOR DE I.V.A. */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Tratamiento de I.V.A.</span>
                      <span className="text-[11px] text-slate-500">
                        {appliesIva ? 'Grava alícuota general SENIAT (16%)' : 'Exento conforme a ley (Cesta básica / Alimentos)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppliesIva(!appliesIva)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        appliesIva ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          appliesIva ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">Estado Fiscal:</span>
                    <span
                      className={`font-black px-2 py-0.5 rounded-md ${
                        appliesIva ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {appliesIva ? 'APLICA I.V.A. (+16%)' : 'EXENTO DE I.V.A.'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción / Ficha Técnica</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Detalles sobre presentación, fabricante, registro sanitario, etc."
                />
              </div>
            </div>
          )}

          {/* ==================== TAB 2: COSTOS, MARGEN Y PRECIOS ALTERNATIVOS ==================== */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Notificación de regla de costo más alto */}
              {highestSupplierCost !== null && highestCostSupplier && (
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900">
                    <p className="font-bold">Regla del Costo Más Alto Activa</p>
                    <p className="text-blue-800">
                      El precio de costo base está fijado automáticamente en{' '}
                      <strong className="font-mono font-bold">{formatUSD(highestSupplierCost)}</strong> según el costo
                      más alto reportado por el proveedor <strong>{highestCostSupplier.supplierName}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Fila principal: Costo, Margen %, Precio Venta USD, Equivalente Bs */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Estructura Base de Precios y Margen de Ganancia
                  </h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                    Soporta Micro-Montos (Hasta 6 decimales)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Precio de Costo USD */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">
                      Precio de Costo (USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={costUSDStr}
                        onChange={(e) => handleCostChange(e.target.value)}
                        placeholder="0.000034"
                        className="w-full pl-6 pr-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Costo unitario de adquisición o reposición</p>
                  </div>

                  {/* Margen de Ganancia % */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs flex items-center justify-between">
                      <span>Margen de Ganancia</span>
                      <span className="text-indigo-600 font-mono font-bold">%</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={profitMarginPercentStr}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        placeholder="30"
                        className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg font-mono font-bold text-indigo-900 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-2 text-indigo-600 font-bold text-xs">%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ganancia: {formatUSD(Math.max(0, currentPriceUSDNum - currentCostUSDNum))}
                    </p>
                  </div>

                  {/* Precio Final de Venta USD */}
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-300 shadow-xs">
                    <label className="block font-bold text-emerald-950 mb-1 text-xs">
                      Precio Final Venta (USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-emerald-700 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={priceUSDStr}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        placeholder="0.000045"
                        className="w-full pl-6 pr-3 py-1.5 border border-emerald-400 rounded-lg font-mono font-black text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-emerald-700 mt-1 font-semibold">PVP al detal para catálogo y POS</p>
                  </div>

                  {/* Equivalente Bs. Tasa BCV */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="block font-bold text-slate-700 text-xs">PVP Oficial en Bolívares</span>
                      <span className="text-[10px] text-slate-400">Tasa BCV: {formatPlainNumber(settings.bcvRate, 2)} Bs/$</span>
                    </div>
                    <div className="font-mono font-black text-slate-900 text-base">
                      {formatBs(currentPriceUSDNum * settings.bcvRate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN PRECIOS ALTERNATIVOS (PROMOCIÓN, OFERTA, GRAN MAYOR) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Precios Alternativos (Promoción, Oferta, Gran Mayor)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Ingresa el % de descuento deseado y el sistema calculará en tiempo real el precio final con alta precisión.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 1. Nivel Promoción */}
                  <div
                    className={`p-3.5 rounded-2xl border transition-all ${
                      alternativePrices.promocion.active
                        ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Precio Promoción
                      </span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alternativePrices.promocion.active}
                          onChange={() => toggleAlternativeActive('promocion')}
                          className="rounded text-blue-600"
                        />
                        <span className="text-[11px] font-semibold text-slate-600">Activar</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Porcentaje de Descuento (%)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={promoDiscountStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setPromoDiscountStr(e.target.value);
                              }
                            }}
                            placeholder="5"
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                          />
                          <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold text-xs">%</span>
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px]">Precio Final USD:</span>
                          <span className="font-mono font-black text-blue-700 text-sm">
                            {formatUSD(alternativePrices.promocion.finalPriceUSD)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Equivalente Bs:</span>
                          <span className="font-mono font-bold">
                            {formatBs(alternativePrices.promocion.finalPriceUSD * settings.bcvRate)}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11px] font-bold text-emerald-700">
                          <span>Ahorro del Cliente:</span>
                          <span className="font-mono">
                            {formatUSD(alternativePrices.promocion.customerSavingsUSD)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Nivel Oferta Especial */}
                  <div
                    className={`p-3.5 rounded-2xl border transition-all ${
                      alternativePrices.oferta.active
                        ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-rose-900 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Precio Oferta Flash
                      </span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alternativePrices.oferta.active}
                          onChange={() => toggleAlternativeActive('oferta')}
                          className="rounded text-rose-600"
                        />
                        <span className="text-[11px] font-semibold text-slate-600">Activar</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Porcentaje de Descuento (%)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ofertaDiscountStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setOfertaDiscountStr(e.target.value);
                              }
                            }}
                            placeholder="10"
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                          />
                          <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold text-xs">%</span>
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px]">Precio Final USD:</span>
                          <span className="font-mono font-black text-rose-700 text-sm">
                            {formatUSD(alternativePrices.oferta.finalPriceUSD)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Equivalente Bs:</span>
                          <span className="font-mono font-bold">
                            {formatBs(alternativePrices.oferta.finalPriceUSD * settings.bcvRate)}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11px] font-bold text-emerald-700">
                          <span>Ahorro del Cliente:</span>
                          <span className="font-mono">
                            {formatUSD(alternativePrices.oferta.customerSavingsUSD)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Nivel Gran Mayor */}
                  <div
                    className={`p-3.5 rounded-2xl border transition-all ${
                      alternativePrices.granMayor.active
                        ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Precio Gran Mayor
                      </span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alternativePrices.granMayor.active}
                          onChange={() => toggleAlternativeActive('granMayor')}
                          className="rounded text-amber-600"
                        />
                        <span className="text-[11px] font-semibold text-slate-600">Activar</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Porcentaje de Descuento (%)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={granMayorDiscountStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setGranMayorDiscountStr(e.target.value);
                              }
                            }}
                            placeholder="15"
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                          />
                          <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold text-xs">%</span>
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px]">Precio Final USD:</span>
                          <span className="font-mono font-black text-amber-800 text-sm">
                            {formatUSD(alternativePrices.granMayor.finalPriceUSD)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Equivalente Bs:</span>
                          <span className="font-mono font-bold">
                            {formatBs(alternativePrices.granMayor.finalPriceUSD * settings.bcvRate)}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11px] font-bold text-emerald-700">
                          <span>Ahorro del Cliente:</span>
                          <span className="font-mono">
                            {formatUSD(alternativePrices.granMayor.customerSavingsUSD)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: PROVEEDORES Y CÓDIGOS DE BARRA ==================== */}
          {activeTab === 'suppliers' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-950 space-y-1">
                    <p className="font-bold text-sm">
                      Proveedores del Producto y Regla del Costo Más Alto
                    </p>
                    <p className="text-blue-800">
                      Asocia los distintos proveedores que surten este mismo artículo con sus respectivos precios de costo
                      y códigos de barras. <strong>El sistema tomará automáticamente el costo más alto entre ellos</strong> para
                      blindar tus márgenes de reposición.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form to link supplier */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Vincular Proveedor a este Producto
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Selector de Proveedores Registrados *
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.rif})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Precio Costo Proveedor (USD) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={supplierCostUSDStr}
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value)) {
                          setSupplierCostUSDStr(e.target.value);
                        }
                      }}
                      placeholder="0.000034"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Código de Barras Proveedor
                    </label>
                    <input
                      type="text"
                      value={supplierBarcode}
                      onChange={(e) => setSupplierBarcode(e.target.value)}
                      placeholder="Ej: 7591234567890"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddSupplier}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Asociar Proveedor
                  </button>
                </div>
              </div>

              {/* Linked suppliers list */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Proveedores Asociados ({suppliersInfo.length})</h4>

                {suppliersInfo.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-semibold text-xs">No hay proveedores vinculados aún.</p>
                    <p className="text-[11px]">Asocia al menos un proveedor para habilitar la regla de costo más alto.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Proveedor</th>
                          <th className="py-2.5 px-3">Cód. Barras Proveedor</th>
                          <th className="py-2.5 px-3 text-right">Costo Ofrecido (USD)</th>
                          <th className="py-2.5 px-3 text-center">Estado Regla</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {suppliersInfo.map((s) => {
                          const isHighest = s.costUSD === highestSupplierCost;
                          return (
                            <tr key={s.id} className={isHighest ? 'bg-blue-50/50 font-medium' : 'hover:bg-slate-50'}>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-900 block">{s.supplierName}</span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded font-bold text-[11px]">
                                  <Barcode className="w-3 h-3 text-slate-400" />
                                  {s.barcode}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatUSD(s.costUSD)} USD
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isHighest ? (
                                  <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                                    <ShieldCheck className="w-3 h-3" />
                                    Costo Máximo (Activo)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Costo menor</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSupplier(s.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                  title="Quitar proveedor"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 4: PRESENTACIONES Y PRECIOS ==================== */}
          {activeTab === 'presentations' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200">
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950 space-y-1">
                    <p className="font-bold text-sm">Presentaciones Comerciales (Tipos) y Precios</p>
                    <p className="text-amber-800">
                      Configura empaques para venta al mayor: Bultos, Cajas, Fardos, Displays o Six-Packs con su respectivo
                      precio especial y factor de contenido.
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Presentation form */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Nueva Presentación / Empaque
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Nombre / Tipo de Presentación *
                    </label>
                    <input
                      type="text"
                      value={newPresName}
                      onChange={(e) => setNewPresName(e.target.value)}
                      placeholder="Ej: Bulto x 24 un, Display x 12"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Unidades que Contiene (Factor) *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPresFactorStr}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setNewPresFactorStr(e.target.value);
                          const fac = parseInt(e.target.value) || 1;
                          const base = parseFreeTextInput(priceUSDStr, 0);
                          setNewPresPriceUSDStr(formatPlainNumber(base * fac * 0.95, 6));
                        }
                      }}
                      placeholder="24"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Precio Presentación (USD) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newPresPriceUSDStr}
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value)) {
                          setNewPresPriceUSDStr(e.target.value);
                        }
                      }}
                      placeholder={formatPlainNumber(parseFreeTextInput(priceUSDStr, 0) * (parseInt(newPresFactorStr) || 1) * 0.95, 6)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Cód. Barras Presentación
                    </label>
                    <input
                      type="text"
                      value={newPresBarcode}
                      onChange={(e) => setNewPresBarcode(e.target.value)}
                      placeholder="Ej: 759000111222"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddPresentation}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Presentación
                  </button>
                </div>
              </div>

              {/* List of presentations */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Presentaciones Registradas ({presentations.length})</h4>

                {presentations.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-semibold text-xs">Sin presentaciones adicionales registradas.</p>
                    <p className="text-[11px]">Se venderá exclusivamente por la unidad de medida base ({unit}).</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {presentations.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{p.factor} unidades</span>
                            <span>•</span>
                            <span className="font-mono font-bold text-emerald-700">{formatUSD(p.priceUSD)} USD</span>
                            <span>•</span>
                            <span>{formatBs(p.priceUSD * settings.bcvRate)}</span>
                          </div>
                          {p.barcode && (
                            <p className="text-[10px] font-mono text-slate-400">Ref / Barra: {p.barcode}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePresentation(p.id)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 5: PRODUCTO COMPUESTO (KIT / COMBO) ==================== */}
          {activeTab === 'composite' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Marcador de Producto Compuesto */}
              <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-purple-950 text-sm flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-purple-700" />
                    ¿Es este un Producto Compuesto? (Combo / Kit / Cesta)
                  </span>
                  <p className="text-xs text-purple-800">
                    Al activarlo, podrás seleccionar los artículos que componen este paquete. El costo total y el stock
                    se calcularán automáticamente según las existencias de cada componente.
                  </p>
                </div>
                <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out">
                  <input
                    type="checkbox"
                    checked={isComposite}
                    onChange={(e) => setIsComposite(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isComposite ? 'translate-x-5 bg-white' : 'translate-x-0'
                    }`}
                  />
                  <span
                    className={`absolute inset-0 rounded-full transition-colors ${
                      isComposite ? 'bg-purple-600' : 'bg-slate-300'
                    }`}
                  />
                </label>
              </div>

              {isComposite ? (
                <div className="space-y-4">
                  {/* Selector para agregar componentes */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                      <Plus className="w-4 h-4 text-purple-600" />
                      Agregar Componente al Combo
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Seleccionar Producto del Inventario *
                        </label>
                        <select
                          value={selectedComponentProductId}
                          onChange={(e) => setSelectedComponentProductId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="">-- Seleccionar producto --</option>
                          {availableProductsForComposite.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock} {p.unit} | Costo: {formatUSD(p.costUSD)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Cantidad Requerida por Combo *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={componentQuantityStr}
                          onChange={(e) => {
                            if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                              setComponentQuantityStr(e.target.value);
                            }
                          }}
                          placeholder="1"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs font-bold"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddCompositeComponent}
                          disabled={!selectedComponentProductId}
                          className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Añadir
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Component list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-xs">
                        Componentes Incluidos ({compositeComponents.length})
                      </h4>
                      {compositeComponents.length > 0 && (
                        <button
                          type="button"
                          onClick={handleApplyCompositeCost}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Aplicar costo acumulado ({formatUSD(compositeTotalCostUSD)} USD)
                        </button>
                      )}
                    </div>

                    {compositeComponents.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                        <Boxes className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                        <p className="font-semibold text-xs">No has agregado componentes aún.</p>
                        <p className="text-[11px]">Selecciona los productos individuales que conforman este kit o combo.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Artículo Componente</th>
                              <th className="py-2.5 px-3 text-center">Cant. Requerida</th>
                              <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                              <th className="py-2.5 px-3 text-right">Subtotal Costo</th>
                              <th className="py-2.5 px-3 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {compositeComponents.map((c) => {
                              const p = products.find((prod) => prod.id === c.productId);
                              const subtotal = c.costUSD * c.quantity;
                              return (
                                <tr key={c.productId} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-slate-900 block">{c.productName}</span>
                                    {p && (
                                      <span className="text-[10px] text-slate-500">
                                        Stock actual: {p.stock} {p.unit}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold font-mono text-purple-700">
                                    x{c.quantity}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                    {formatUSD(c.costUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                    {formatUSD(subtotal)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCompositeComponent(c.productId)}
                                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                            <tr>
                              <td colSpan={3} className="py-2.5 px-3 text-right text-slate-700">
                                Costo Total de Componentes:
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-purple-800 text-sm">
                                {formatUSD(compositeTotalCostUSD)} USD
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* Virtual stock alert */}
                    {compositeComponents.length > 0 && (
                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-purple-600" />
                          <span className="font-bold text-purple-900">Stock Virtual Armable:</span>
                        </div>
                        <span className="font-mono font-black text-purple-900 text-sm">
                          {compositeVirtualStock} combos disponibles
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500">
                  <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-sm text-slate-700">Producto Estándar (No Compuesto)</p>
                  <p className="text-xs max-w-sm mx-auto mt-1">
                    Activa el interruptor superior si deseas crear un kit, combo o cesta navideña compuesta por varios
                    artículos del inventario.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 6: FOTOGRAFÍA & CÁMARA ==================== */}
          {activeTab === 'image' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Preview */}
                <div className="space-y-3">
                  <label className="block font-bold text-slate-800 text-xs">Previsualización de Imagen</label>
                  <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center shadow-inner">
                    {image ? (
                      <img src={image} alt={name || 'Producto'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-10 h-10 mx-auto mb-1 text-slate-300" />
                        <span className="text-xs">Sin imagen seleccionada</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      O ingresar URL directa de imagen:
                    </label>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Right: Upload from PC and Camera */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs mb-2">Métodos de Carga de Imagen</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Button: Upload from PC / Device */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-xs hover:border-indigo-400"
                      >
                        <Upload className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-xs">Cargar desde PC / Dispositivo</span>
                        <span className="text-[10px] text-slate-400">Archivos JPG, PNG</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {/* Button: Open Live Camera */}
                      <button
                        type="button"
                        onClick={startCamera}
                        className="p-3 rounded-xl border border-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-950 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Camera className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-xs">Usar Cámara en Vivo</span>
                        <span className="text-[10px] text-indigo-600">Captura instantánea</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Camera Viewfinder */}
                  {isCameraActive && (
                    <div className="p-3 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between text-white">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          Cámara Activa
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={switchFacingMode}
                            className="p-1 text-slate-400 hover:text-white rounded"
                            title="Cambiar cámara (frontal/trasera)"
                          >
                            <SwitchCamera className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-1 text-slate-400 hover:text-white rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="relative aspect-4/3 w-full bg-black rounded-xl overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      </div>

                      <div className="flex justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer animate-pulse"
                        >
                          <Camera className="w-4 h-4" />
                          Tomar Foto Ahora
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {/* Suggestions Preset Images */}
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                      O sugerencias rápidas por categoría:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: 'Harina / Grano', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80' },
                        { label: 'Aceite / Botella', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' },
                        { label: 'Pasta / Arroz', url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=600&q=80' },
                        { label: 'Lácteos / Queso', url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80' },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImage(item.url)}
                          className="p-1.5 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-slate-50 text-[10px] text-slate-700 truncate cursor-pointer text-center"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Resumen:</span>
              <span className="font-bold text-slate-800">
                Costo: <strong className="font-mono text-slate-900">{formatUSD(currentCostUSDNum)}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-indigo-700">Margen: {profitMarginPercentStr}%</span>
              <span className="text-slate-300">•</span>
              <span className="font-black text-emerald-800 font-mono text-sm">PVP: {formatUSD(currentPriceUSDNum)} USD</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                {productToEdit ? 'Guardar Cambios' : 'Crear y Registrar Producto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
