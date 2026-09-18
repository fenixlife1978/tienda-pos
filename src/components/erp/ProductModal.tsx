import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Product,
  ProductPresentation,
  ProductSupplierInfo,
  AlternativePrices,
  CompositeComponent,
  PricingMethod,
  PriceListMatrix,
  SalesPresentationsConfig,
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
  Info,
  Boxes,
  Barcode,
  ShieldCheck,
  SwitchCamera,
  Image as ImageIcon,
  Calculator,
  Warehouse,
  MapPin,
  TrendingUp,
  Scale,
  Wine,
  CheckSquare,
  Square,
  Tag,
  Sliders,
  Coins,
  Wand2,
} from 'lucide-react';
import {
  formatUSD,
  formatBs,
  formatPlainNumber,
  isValidDecimalInput,
  parseFreeTextInput,
} from '../../utils/formatUtils';
import {
  generateUniqueSKU,
  validateSKU,
  SKUStrategy,
} from '../../utils/skuGenerator';

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
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'inventory' | 'presentations' | 'suppliers' | 'composite'>('general');

  // ==================== TAB 1: DATOS BÁSICOS ====================
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [ean, setEan] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Víveres');
  const [unit, setUnit] = useState(units[0]?.name || 'Unidad');
  const [description, setDescription] = useState('');

  // SKU Generator & Validation State
  const [isSkuGeneratorOpen, setIsSkuGeneratorOpen] = useState(false);
  const [skuStrategy, setSkuStrategy] = useState<SKUStrategy>('category_name_seq');
  const [customSkuPrefix, setCustomSkuPrefix] = useState('SKU');
  const [skuDigits, setSkuDigits] = useState(4);

  // Live SKU Uniqueness and Syntax Validation
  const skuValidation = useMemo(() => {
    return validateSKU(code, products, productToEdit?.id);
  }, [code, products, productToEdit]);

  const handleGenerateSKU = (strategyToUse?: SKUStrategy) => {
    const strat = strategyToUse || skuStrategy;
    const newSku = generateUniqueSKU(
      {
        strategy: strat,
        category,
        name: name.trim() || 'PRODUCTO',
        prefix: customSkuPrefix,
        digits: skuDigits,
      },
      products,
      productToEdit?.id
    );
    setCode(newSku);
  };

  // ==================== TAB 2: ESTRUCTURA DE COSTOS Y FORMACIÓN DE PRECIOS ====================
  // 1. Estructura de costos
  const [costUSDStr, setCostUSDStr] = useState<string>('10.0'); // Costo de compra
  const [additionalExpensesPercentStr, setAdditionalExpensesPercentStr] = useState<string>('0'); // Gastos adicionales %
  const [lastCostUSDStr, setLastCostUSDStr] = useState<string>('10.0'); // Último costo registrado

  // 2. Métodos de formación de precio: 'markup' | 'margin_on_sale' | 'gap_system' | 'manual'
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('markup');
  const [profitMarginPercentStr, setProfitMarginPercentStr] = useState<string>('30'); // Margen %
  const [gapPercentStr, setGapPercentStr] = useState<string>('10'); // % Brecha
  const [manualPriceUSDStr, setManualPriceUSDStr] = useState<string>('13.0'); // Precio manual directo

  // 3. Parámetros fiscales: 16% (General), 8% (Reducida), 0% (Exento)
  const [ivaRate, setIvaRate] = useState<number>(0);

  // 4. Precios alternativos: Matriz de listas (Público, Mayorista, Distribuidor, Especial)
  const [matrixPublicoMarginStr, setMatrixPublicoMarginStr] = useState<string>('30');
  const [matrixMayoristaMarginStr, setMatrixMayoristaMarginStr] = useState<string>('18');
  const [matrixDistribuidorMarginStr, setMatrixDistribuidorMarginStr] = useState<string>('12');
  const [matrixEspecialMarginStr, setMatrixEspecialMarginStr] = useState<string>('22');
  const [matrixActive, setMatrixActive] = useState({
    publico: true,
    mayorista: true,
    distribuidor: true,
    especial: true,
  });

  // Alternative Prices (compatibilidad legacy promocion, oferta, granMayor)
  const [alternativePrices, setAlternativePrices] = useState<AlternativePrices>({
    promocion: { discountPercent: 5, finalPriceUSD: 0, customerSavingsUSD: 0, active: false },
    oferta: { discountPercent: 10, finalPriceUSD: 0, customerSavingsUSD: 0, active: false },
    granMayor: { discountPercent: 15, finalPriceUSD: 0, customerSavingsUSD: 0, active: false },
  });

  // ==================== TAB 3: INVENTARIO ====================
  const [initialStockStr, setInitialStockStr] = useState<string>('50');
  const [stockStr, setStockStr] = useState<string>('50');
  const [minStockStr, setMinStockStr] = useState<string>('10');
  const [maxStockStr, setMaxStockStr] = useState<string>('200');
  const [reorderPointStr, setReorderPointStr] = useState<string>('20');
  const [warehouse, setWarehouse] = useState<string>('Principal');
  const [location, setLocation] = useState<string>('Pasillo A - Estante 1');

  // ==================== TAB 4: PRESENTACIONES Y UNIDADES DE VENTA ====================
  const [mainPresentation, setMainPresentation] = useState<string>('Unidad');
  const [contentQuantityStr, setContentQuantityStr] = useState<string>('1');
  const [baseUnit, setBaseUnit] = useState<string>('Unidad');
  const [conversionFactorStr, setConversionFactorStr] = useState<string>('1');

  // Modalidades permitidas con casillas de verificación
  const [allowedModes, setAllowedModes] = useState({
    originalPresentation: true,
    unit: true,
    fractional: false,
    shots: false,
    contentControl: false,
  });

  // Modalidades avanzadas legacy / venta balanza y fraccionada
  const [isWeighable, setIsWeighable] = useState(false);
  const [pricePerKgUSDStr, setPricePerKgUSDStr] = useState<string>('');
  const [isFractionable, setIsFractionable] = useState(false);
  const [fractionUnit, setFractionUnit] = useState('Litro');

  // Presentaciones registradas adicionales (bultos, cajas, fardos)
  const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
  const [newPresName, setNewPresName] = useState('Caja x 12 un');
  const [newPresFactorStr, setNewPresFactorStr] = useState<string>('12');
  const [newPresPriceUSDStr, setNewPresPriceUSDStr] = useState<string>('');
  const [newPresBarcode, setNewPresBarcode] = useState('');

  // ==================== TAB 5: PROVEEDORES ====================
  const [suppliersInfo, setSuppliersInfo] = useState<ProductSupplierInfo[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierCostUSDStr, setSupplierCostUSDStr] = useState<string>('10.0');
  const [supplierBarcode, setSupplierBarcode] = useState<string>('');

  // ==================== TAB 6: PRODUCTO COMPUESTO (KIT / COMBO) ====================
  const [isComposite, setIsComposite] = useState<boolean>(false);
  const [compositeComponents, setCompositeComponents] = useState<CompositeComponent[]>([]);
  const [selectedComponentProductId, setSelectedComponentProductId] = useState<string>('');
  const [componentQuantityStr, setComponentQuantityStr] = useState<string>('1');

  // ==================== FOTOGRAFÍA & CÁMARA ====================
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
        setBarcode(productToEdit.barcode || productToEdit.ean || '');
        setEan(productToEdit.ean || productToEdit.barcode || '');
        setName(productToEdit.name);
        setCategory(productToEdit.category || (categories[0]?.name || 'Víveres'));
        setUnit(productToEdit.unit || (units[0]?.name || 'Unidad'));
        setDescription(productToEdit.description || '');

        // Cost structure
        const cUSD = productToEdit.costUSD ?? 10.0;
        const addExp = productToEdit.additionalExpensesPercent ?? 0;
        const lastC = productToEdit.lastCostUSD ?? cUSD;
        setCostUSDStr(formatPlainNumber(cUSD, 6));
        setAdditionalExpensesPercentStr(formatPlainNumber(addExp, 2));
        setLastCostUSDStr(formatPlainNumber(lastC, 6));

        // Pricing method & margins
        const pMethod = productToEdit.pricingMethod || 'markup';
        setPricingMethod(pMethod);
        const marginVal = productToEdit.profitMarginPercent ?? 30;
        setProfitMarginPercentStr(formatPlainNumber(marginVal, 2));
        setGapPercentStr(formatPlainNumber(productToEdit.gapPercent ?? 10, 2));
        setManualPriceUSDStr(formatPlainNumber(productToEdit.priceUSD ?? 13.0, 6));

        // Fiscal parameters (IVA)
        if (productToEdit.ivaRate !== undefined) {
          setIvaRate(productToEdit.ivaRate);
        } else {
          setIvaRate(productToEdit.appliesIva ? 16 : 0);
        }

        // Price List Matrix
        if (productToEdit.priceListMatrix) {
          setMatrixPublicoMarginStr(formatPlainNumber(productToEdit.priceListMatrix.publico.marginPercent, 2));
          setMatrixMayoristaMarginStr(formatPlainNumber(productToEdit.priceListMatrix.mayorista.marginPercent, 2));
          setMatrixDistribuidorMarginStr(formatPlainNumber(productToEdit.priceListMatrix.distribuidor.marginPercent, 2));
          setMatrixEspecialMarginStr(formatPlainNumber(productToEdit.priceListMatrix.especial.marginPercent, 2));
          setMatrixActive({
            publico: productToEdit.priceListMatrix.publico.active ?? true,
            mayorista: productToEdit.priceListMatrix.mayorista.active ?? true,
            distribuidor: productToEdit.priceListMatrix.distribuidor.active ?? true,
            especial: productToEdit.priceListMatrix.especial.active ?? true,
          });
        } else {
          setMatrixPublicoMarginStr(formatPlainNumber(marginVal, 2));
          setMatrixMayoristaMarginStr('18');
          setMatrixDistribuidorMarginStr('12');
          setMatrixEspecialMarginStr('22');
        }

        // Inventory
        setInitialStockStr(String(productToEdit.initialStock ?? productToEdit.stock ?? 50));
        setStockStr(String(productToEdit.stock ?? 50));
        setMinStockStr(String(productToEdit.minStock ?? 10));
        setMaxStockStr(String(productToEdit.maxStock ?? 200));
        setReorderPointStr(String(productToEdit.reorderPoint ?? 20));
        setWarehouse(productToEdit.warehouse || 'Principal');
        setLocation(productToEdit.location || 'Pasillo A - Estante 1');

        // Presentations & Sales Units Config
        if (productToEdit.salesPresentationsConfig) {
          setMainPresentation(productToEdit.salesPresentationsConfig.mainPresentation || 'Unidad');
          setContentQuantityStr(String(productToEdit.salesPresentationsConfig.contentQuantity || 1));
          setBaseUnit(productToEdit.salesPresentationsConfig.baseUnit || productToEdit.unit || 'Unidad');
          setConversionFactorStr(String(productToEdit.salesPresentationsConfig.conversionFactor || 1));
          setAllowedModes(productToEdit.salesPresentationsConfig.allowedModes || {
            originalPresentation: true,
            unit: true,
            fractional: Boolean(productToEdit.isFractionable),
            shots: false,
            contentControl: Boolean(productToEdit.isWeighable),
          });
        } else {
          setMainPresentation('Unidad');
          setContentQuantityStr('1');
          setBaseUnit(productToEdit.unit || 'Unidad');
          setConversionFactorStr('1');
          setAllowedModes({
            originalPresentation: true,
            unit: true,
            fractional: Boolean(productToEdit.isFractionable),
            shots: false,
            contentControl: Boolean(productToEdit.isWeighable),
          });
        }

        setIsWeighable(Boolean(productToEdit.isWeighable));
        setPricePerKgUSDStr(
          productToEdit.pricePerKgUSD !== undefined ? formatPlainNumber(productToEdit.pricePerKgUSD, 6) : ''
        );
        setIsFractionable(Boolean(productToEdit.isFractionable));
        setFractionUnit(productToEdit.fractionUnit || 'Litro');

        setPresentations(productToEdit.presentations || []);
        setSuppliersInfo(productToEdit.suppliersInfo || []);
        setIsComposite(Boolean(productToEdit.isComposite));
        setCompositeComponents(productToEdit.compositeComponents || []);
        setImage(productToEdit.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
      } else {
        // New product defaults with collision-free unique SKU
        const initialCategory = categories[0]?.name || 'Víveres';
        const initialSku = generateUniqueSKU(
          {
            strategy: 'category_name_seq',
            category: initialCategory,
            name: 'NUEVO',
            prefix: 'SKU',
            digits: 4,
          },
          products
        );
        setCode(initialSku);
        setBarcode('');
        setEan('');
        setName('');
        setCategory(initialCategory);
        setUnit(units[0]?.name || 'Unidad');
        setDescription('');

        const initCost = 10.0;
        const initMargin = 30;
        setCostUSDStr(formatPlainNumber(initCost, 6));
        setAdditionalExpensesPercentStr('0');
        setLastCostUSDStr(formatPlainNumber(initCost, 6));
        setPricingMethod('markup');
        setProfitMarginPercentStr(formatPlainNumber(initMargin, 2));
        setGapPercentStr('10');
        setManualPriceUSDStr(formatPlainNumber(initCost * (1 + initMargin / 100), 6));
        setIvaRate(0); // Exento por defecto

        setMatrixPublicoMarginStr('30');
        setMatrixMayoristaMarginStr('18');
        setMatrixDistribuidorMarginStr('12');
        setMatrixEspecialMarginStr('22');
        setMatrixActive({
          publico: true,
          mayorista: true,
          distribuidor: true,
          especial: true,
        });

        setInitialStockStr('50');
        setStockStr('50');
        setMinStockStr('10');
        setMaxStockStr('200');
        setReorderPointStr('20');
        setWarehouse('Principal');
        setLocation('Pasillo A - Estante 1');

        setMainPresentation('Unidad');
        setContentQuantityStr('1');
        setBaseUnit(units[0]?.name || 'Unidad');
        setConversionFactorStr('1');
        setAllowedModes({
          originalPresentation: true,
          unit: true,
          fractional: false,
          shots: false,
          contentControl: false,
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

  // ==================== CÁLCULOS EN VIVO DE COSTO REAL & PRECIOS ====================
  // 1. Costo base y Gastos adicionales
  const rawCostUSD = parseFreeTextInput(costUSDStr, 0);
  const additionalExpensesPercent = parseFreeTextInput(additionalExpensesPercentStr, 0);
  const realCostUSD = useMemo(() => {
    return rawCostUSD * (1 + additionalExpensesPercent / 100);
  }, [rawCostUSD, additionalExpensesPercent]);

  // 2. Margen, Brecha y Precio Base sin IVA según método seleccionado
  const profitMarginPercent = parseFreeTextInput(profitMarginPercentStr, 0);
  const gapPercent = parseFreeTextInput(gapPercentStr, 0);

  const calculatedBasePriceUSD = useMemo(() => {
    if (realCostUSD <= 0) return 0;
    switch (pricingMethod) {
      case 'markup':
        // Costo Real × (1 + Margen%)
        return realCostUSD * (1 + profitMarginPercent / 100);
      case 'margin_on_sale':
        // Costo Real / (1 - Margen%)
        if (profitMarginPercent >= 100) return realCostUSD * 2;
        return realCostUSD / (1 - profitMarginPercent / 100);
      case 'gap_system':
        // Costo Real × (1 + Margen%) × (1 + Brecha%)
        return realCostUSD * (1 + profitMarginPercent / 100) * (1 + gapPercent / 100);
      case 'manual':
        // Entrada de precio directo
        return parseFreeTextInput(manualPriceUSDStr, 0);
      default:
        return realCostUSD * (1 + profitMarginPercent / 100);
    }
  }, [realCostUSD, pricingMethod, profitMarginPercent, gapPercent, manualPriceUSDStr]);

  // 3. IVA y Precios Finales
  const ivaAmountUSD = useMemo(() => {
    return calculatedBasePriceUSD * (ivaRate / 100);
  }, [calculatedBasePriceUSD, ivaRate]);

  const finalPriceUSD = useMemo(() => {
    return calculatedBasePriceUSD + ivaAmountUSD;
  }, [calculatedBasePriceUSD, ivaAmountUSD]);

  // Ganancia bruta en USD y %
  const grossProfitUSD = useMemo(() => {
    return Math.max(0, calculatedBasePriceUSD - realCostUSD);
  }, [calculatedBasePriceUSD, realCostUSD]);

  const effectiveProfitPercent = useMemo(() => {
    if (realCostUSD <= 0) return 0;
    return ((calculatedBasePriceUSD - realCostUSD) / realCostUSD) * 100;
  }, [calculatedBasePriceUSD, realCostUSD]);

  // 4. Matriz de listas calculada en tiempo real
  const matrixListsCalculated = useMemo(() => {
    const calcList = (marginStr: string, active: boolean, name: string) => {
      const margin = parseFreeTextInput(marginStr, 0);
      let baseUSD = 0;
      switch (pricingMethod) {
        case 'margin_on_sale':
          baseUSD = margin < 100 ? realCostUSD / (1 - margin / 100) : realCostUSD * (1 + margin / 100);
          break;
        case 'gap_system':
          baseUSD = realCostUSD * (1 + margin / 100) * (1 + gapPercent / 100);
          break;
        default:
          baseUSD = realCostUSD * (1 + margin / 100);
          break;
      }
      const totalUSD = baseUSD * (1 + ivaRate / 100);
      const totalBs = totalUSD * settings.bcvRate;
      return {
        name,
        marginPercent: margin,
        priceUSD: totalUSD,
        priceBs: totalBs,
        active,
      };
    };

    return {
      publico: calcList(matrixPublicoMarginStr, matrixActive.publico, 'Público / Detal'),
      mayorista: calcList(matrixMayoristaMarginStr, matrixActive.mayorista, 'Mayorista'),
      distribuidor: calcList(matrixDistribuidorMarginStr, matrixActive.distribuidor, 'Distribuidor'),
      especial: calcList(matrixEspecialMarginStr, matrixActive.especial, 'Especial / VIP'),
    };
  }, [
    realCostUSD,
    pricingMethod,
    gapPercent,
    ivaRate,
    settings.bcvRate,
    matrixPublicoMarginStr,
    matrixMayoristaMarginStr,
    matrixDistribuidorMarginStr,
    matrixEspecialMarginStr,
    matrixActive,
  ]);

  // Sincronizar compatibilidad con AlternativePrices
  useEffect(() => {
    const pUSD = finalPriceUSD;
    setAlternativePrices({
      promocion: {
        discountPercent: 5,
        finalPriceUSD: pUSD * 0.95,
        customerSavingsUSD: pUSD * 0.05,
        active: false,
      },
      oferta: {
        discountPercent: 10,
        finalPriceUSD: pUSD * 0.90,
        customerSavingsUSD: pUSD * 0.10,
        active: false,
      },
      granMayor: {
        discountPercent: 15,
        finalPriceUSD: pUSD * 0.85,
        customerSavingsUSD: pUSD * 0.15,
        active: false,
      },
    });
  }, [finalPriceUSD]);

  // REGLA DEL COSTO MÁS ALTO ENTRE PROVEEDORES
  const highestSupplierCost = useMemo(() => {
    if (suppliersInfo.length === 0) return null;
    return Math.max(...suppliersInfo.map((s) => s.costUSD));
  }, [suppliersInfo]);

  const highestCostSupplier = useMemo(() => {
    if (suppliersInfo.length === 0) return null;
    return suppliersInfo.reduce((prev, curr) => (curr.costUSD > prev.costUSD ? curr : prev), suppliersInfo[0]);
  }, [suppliersInfo]);

  useEffect(() => {
    if (highestSupplierCost !== null && highestSupplierCost > 0) {
      setCostUSDStr(formatPlainNumber(highestSupplierCost, 6));
    }
  }, [highestSupplierCost]);

  // Handlers para Presentaciones adicionales
  const handleAddPresentation = () => {
    if (!newPresName.trim()) return;
    const factor = Math.max(1, parseInt(newPresFactorStr) || 1);
    const customPrice = parseFreeTextInput(newPresPriceUSDStr, 0);
    const suggestedPrice = customPrice > 0 ? customPrice : finalPriceUSD * factor * 0.95;

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

  // Handlers para Proveedores
  const handleAddSupplier = () => {
    if (!selectedSupplierId) return;
    const supp = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supp) return;

    if (suppliersInfo.some((s) => s.supplierId === selectedSupplierId)) {
      alert(`El proveedor ${supp.name} ya está vinculado a este producto.`);
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

    setSuppliersInfo((prev) => [...prev, newSupplierItem]);
    setSupplierBarcode('');
    setSupplierCostUSDStr('10.0');
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliersInfo((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers para Combo / Kit Compuesto
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

  // Image Upload File Handler
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

  // Live Camera Handlers
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara.');
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(err.message || 'No se pudo acceder a la cámara. Permite el acceso o carga un archivo.');
      setIsCameraActive(false);
    }
  };

  const switchFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    stopCamera();
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

  // SUBMIT HANDLER
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor ingrese el nombre comercial del producto.');
      setActiveTab('general');
      return;
    }

    // Strict SKU Uniqueness & Syntax Validation
    const skuCheck = validateSKU(code, products, productToEdit?.id);
    if (!skuCheck.isValid) {
      alert(skuCheck.error || 'Código SKU inválido.');
      setActiveTab('general');
      return;
    }

    if (realCostUSD <= 0) {
      alert('El costo de compra real debe ser mayor a 0.');
      setActiveTab('pricing');
      return;
    }

    if (finalPriceUSD <= 0) {
      alert('El precio de venta debe ser mayor a 0.');
      setActiveTab('pricing');
      return;
    }

    const finalStock = parseInt(stockStr) || 0;
    const finalInitialStock = parseInt(initialStockStr) || finalStock;
    const finalMinStock = parseInt(minStockStr) || 0;
    const finalMaxStock = parseInt(maxStockStr) || 200;
    const finalReorderPoint = parseInt(reorderPointStr) || 20;

    const calculatedStock = isComposite && compositeComponents.length > 0 ? compositeVirtualStock : finalStock;

    // Sincronizar modalidades de balanza y fraccionado con allowedModes
    const isWeighableActive = allowedModes.contentControl || isWeighable;
    const isFractionableActive = allowedModes.fractional || allowedModes.shots || isFractionable;

    const salesConfig: SalesPresentationsConfig = {
      mainPresentation: mainPresentation.trim() || 'Unidad',
      contentQuantity: parseFreeTextInput(contentQuantityStr, 1),
      baseUnit: baseUnit.trim() || unit.trim() || 'Unidad',
      conversionFactor: parseFreeTextInput(conversionFactorStr, 1),
      allowedModes: {
        ...allowedModes,
        contentControl: isWeighableActive,
        fractional: isFractionableActive,
      },
    };

    const priceListMatrix: PriceListMatrix = matrixListsCalculated;

    const productPayload: Omit<Product, 'id'> = {
      code: code.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: barcode.trim() || undefined,
      ean: ean.trim() || barcode.trim() || undefined,
      name: name.trim(),
      category: category.trim() || 'Víveres',
      unit: unit.trim() || 'Unidad',
      description: description.trim(),

      // Estructura de costos
      costUSD: rawCostUSD,
      additionalExpensesPercent,
      realCostUSD,
      lastCostUSD: parseFreeTextInput(lastCostUSDStr, rawCostUSD),

      // Métodos de fijación de precios y márgenes
      pricingMethod,
      profitMarginPercent,
      gapPercent,
      ivaRate,
      appliesIva: ivaRate > 0,
      priceUSD: finalPriceUSD,
      priceListMatrix,

      // Pestaña Inventario
      stock: calculatedStock,
      initialStock: finalInitialStock,
      minStock: finalMinStock,
      maxStock: finalMaxStock,
      reorderPoint: finalReorderPoint,
      warehouse: warehouse.trim() || 'Principal',
      location: location.trim() || 'Pasillo A - Estante 1',

      // Pestaña Presentaciones & Venta
      salesPresentationsConfig: salesConfig,
      presentations: presentations.length > 0 ? presentations : undefined,
      isWeighable: isWeighableActive,
      pricePerKgUSD: isWeighableActive ? (parseFreeTextInput(pricePerKgUSDStr, 0) || finalPriceUSD) : undefined,
      isFractionable: isFractionableActive,
      fractionUnit: isFractionableActive ? fractionUnit : undefined,

      // Proveedores y combos
      suppliersInfo: suppliersInfo.length > 0 ? suppliersInfo : undefined,
      highestSupplierCost: highestSupplierCost ?? undefined,
      isComposite,
      compositeComponents: isComposite ? compositeComponents : undefined,
      compositeVirtualStock: isComposite ? compositeVirtualStock : undefined,

      image,
      isOffer: false,
      discountPercentage: 0,
      alternativePrices,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                {productToEdit ? `Editar Producto: ${productToEdit.name}` : 'Creación de Nuevo Producto'}
              </h3>
              <p className="text-xs text-slate-500">
                Estructura de costos, formación de precio, impuestos, inventario y presentaciones
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
            Pestaña 1: Información General
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
            Pestaña 2: Costos & Precios ({formatUSD(finalPriceUSD)})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            Pestaña 3: Inventario & Ubicación
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
            Pestaña 4: Presentaciones & Venta
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
            Proveedores ({suppliersInfo.length})
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
        </div>

        {/* Modal Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          
          {/* ==================== TAB 1: INFORMACIÓN GENERAL ==================== */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left 2 Cols: Form Data */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span>Código / SKU / Barra *</span>
                          {skuValidation.isValid && !skuValidation.warning && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Único
                            </span>
                          )}
                          {skuValidation.isDuplicate && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 animate-pulse">
                              <AlertCircle className="w-2.5 h-2.5 text-rose-600" /> Repetido
                            </span>
                          )}
                        </label>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGenerateSKU('category_name_seq')}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer inline-flex items-center gap-0.5"
                            title="Generar automáticamente un código único basado en la categoría y nombre"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-600" /> Auto-SKU
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSkuGeneratorOpen(!isSkuGeneratorOpen)}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition cursor-pointer ${
                              isSkuGeneratorOpen
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                            title="Abrir opciones de formato de SKU"
                          >
                            ⚙️ Opciones
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className={`w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 font-bold uppercase transition ${
                          skuValidation.isDuplicate
                            ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                            : skuValidation.warning
                            ? 'border-amber-300 focus:ring-amber-500'
                            : 'border-slate-300 focus:ring-indigo-500'
                        }`}
                        placeholder="SKU-100234"
                      />

                      {/* Duplicate Alert Banner & 1-Click Fix */}
                      {skuValidation.isDuplicate && skuValidation.duplicateProduct && (
                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-700 flex items-start justify-between gap-2 shadow-2xs">
                          <div>
                            <p className="font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Código ya asignado:
                            </p>
                            <p className="text-[10px] text-rose-600 mt-0.5">
                              En uso por <strong className="font-bold">{skuValidation.duplicateProduct.name}</strong> ({skuValidation.duplicateProduct.category})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateSKU('category_name_seq')}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] shrink-0 cursor-pointer shadow-2xs transition flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            Corregir
                          </button>
                        </div>
                      )}

                      {skuValidation.warning && (
                        <p className="text-[10px] text-amber-600 font-medium">{skuValidation.warning}</p>
                      )}

                      {/* SKU Generator Strategy Selector Box */}
                      {isSkuGeneratorOpen && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                              <Wand2 className="w-3 h-3 text-indigo-600" />
                              Formatos de SKU Disponibles
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsSkuGeneratorOpen(false)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleGenerateSKU('category_name_seq')}
                              className="p-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-lg text-left transition cursor-pointer shadow-2xs"
                            >
                              <p className="font-bold text-slate-800 text-[10px]">Cat. + Nombre</p>
                              <p className="text-[9px] font-mono text-indigo-600">Ej: VIV-HAR-0001</p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleGenerateSKU('ean13')}
                              className="p-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-lg text-left transition cursor-pointer shadow-2xs"
                            >
                              <p className="font-bold text-slate-800 text-[10px]">EAN-13 (13 dígitos)</p>
                              <p className="text-[9px] font-mono text-indigo-600">Ej: 7590001000427</p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleGenerateSKU('category_seq')}
                              className="p-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-lg text-left transition cursor-pointer shadow-2xs"
                            >
                              <p className="font-bold text-slate-800 text-[10px]">Cat. Secuencial</p>
                              <p className="text-[9px] font-mono text-indigo-600">Ej: VIV-0042</p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleGenerateSKU('prefix_seq')}
                              className="p-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-lg text-left transition cursor-pointer shadow-2xs"
                            >
                              <p className="font-bold text-slate-800 text-[10px]">Prefijo Estándar</p>
                              <p className="text-[9px] font-mono text-indigo-600">Ej: SKU-0042</p>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Nombre Comercial del Producto *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                        placeholder="Ej: Harina de Maíz Precocida 1Kg, Queso Llanero, Ron Añejo..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Código de Barras Físico / EAN-13</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const random12 = '759' + Math.floor(100000000 + Math.random() * 900000000).toString();
                            let sum = 0;
                            for (let i = 0; i < 12; i++) {
                              sum += parseInt(random12[i]) * (i % 2 === 0 ? 1 : 3);
                            }
                            const checkDigit = (10 - (sum % 10)) % 10;
                            const ean13 = random12 + checkDigit;
                            setBarcode(ean13);
                            setEan(ean13);
                          }}
                          className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                          title="Generar un código de barras EAN-13 estándar de 13 dígitos con dígito verificador"
                        >
                          + Auto-EAN13
                        </button>
                      </div>
                      <input
                        type="text"
                        value={barcode}
                        onChange={(e) => {
                          setBarcode(e.target.value);
                          setEan(e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900"
                        placeholder="Ej: 7591001000018..."
                      />
                    </div>

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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="flex items-end">
                      <div className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                        <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Compatible con escaneo óptico por cámara y pistolas USB.</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Descripción / Ficha Técnica</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      placeholder="Detalles sobre presentación, fabricante, registro sanitario, especificaciones..."
                    />
                  </div>

                  {/* Resumen rápido de configuraciones */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-800 text-xs">Atajos de Configuración:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('pricing')}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:border-indigo-500 cursor-pointer"
                      >
                        Configurar Costos y Métodos →
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('inventory')}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:border-indigo-500 cursor-pointer"
                      >
                        Gestionar Inventario →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right 1 Col: Photo & Camera Integration */}
                <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      Imagen del Producto
                    </label>
                  </div>

                  <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center shadow-inner">
                    {image ? (
                      <img src={image} alt={name || 'Producto'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                        <span className="text-[11px]">Sin imagen seleccionada</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-2xs hover:border-indigo-400"
                    >
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-[11px]">Cargar Archivo</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={startCamera}
                      className="p-2 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-[11px]">Cámara en Vivo</span>
                    </button>
                  </div>

                  {/* Live Camera Viewfinder if active */}
                  {isCameraActive && (
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-white text-[11px]">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          Cámara Activa
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={switchFacingMode}
                            className="p-1 text-slate-300 hover:text-white"
                            title="Rotar cámara"
                          >
                            <SwitchCamera className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-1 text-slate-300 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="relative aspect-4/3 w-full bg-black rounded-lg overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      </div>

                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Capturar Fotografía
                      </button>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-[10px] font-mono"
                      placeholder="URL de imagen https://..."
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== TAB 2: COSTOS, MÉTODOS Y PRECIOS ==================== */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Notificación de regla de costo más alto si aplica */}
              {highestSupplierCost !== null && highestCostSupplier && (
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900">
                    <p className="font-bold">Regla del Costo Más Alto de Proveedor Activa</p>
                    <p className="text-blue-800">
                      El costo de compra está sincronizado automáticamente en{' '}
                      <strong className="font-mono font-bold">{formatUSD(highestSupplierCost)}</strong> por el proveedor{' '}
                      <strong>{highestCostSupplier.supplierName}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. SECCIÓN: ESTRUCTURA DE COSTOS */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    1. Estructura de Costos de Adquisición
                  </h4>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    Fórmula: Costo Real = Costo × (1 + Gastos%)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Costo de compra en USD */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">
                      Costo de Compra (USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={costUSDStr}
                        onChange={(e) => {
                          if (isValidDecimalInput(e.target.value)) {
                            setCostUSDStr(e.target.value);
                          }
                        }}
                        placeholder="10.00"
                        className="w-full pl-6 pr-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Precio factura del proveedor en divisas</p>
                  </div>

                  {/* Gastos adicionales en porcentaje (%) */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs flex items-center justify-between">
                      <span>Gastos Adicionales</span>
                      <span className="text-amber-600 font-mono font-bold">%</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={additionalExpensesPercentStr}
                        onChange={(e) => {
                          if (isValidDecimalInput(e.target.value)) {
                            setAdditionalExpensesPercentStr(e.target.value);
                          }
                        }}
                        placeholder="0"
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg font-mono font-bold text-amber-900 text-sm focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="absolute right-3 top-2 text-amber-600 font-bold text-xs">%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Fletes, seguros, aranceles, empaque</p>
                  </div>

                  {/* Cálculo automático de Costo Real */}
                  <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="block font-bold text-indigo-950 text-xs">Costo Real Calculado</span>
                      <span className="text-[10px] text-indigo-700">Costo + Gastos adicionales</span>
                    </div>
                    <div className="font-mono font-black text-indigo-900 text-base">
                      {formatUSD(realCostUSD)} USD
                    </div>
                  </div>

                  {/* Último Costo Registrado */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">
                      Último Costo (Auditoría)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lastCostUSDStr}
                        onChange={(e) => {
                          if (isValidDecimalInput(e.target.value)) {
                            setLastCostUSDStr(e.target.value);
                          }
                        }}
                        placeholder="10.00"
                        className="w-full pl-6 pr-3 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold text-slate-700 text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Historial del último costo pagado</p>
                  </div>
                </div>
              </div>

              {/* 2. SECCIÓN: 4 MÉTODOS DE FORMACIÓN DE PRECIO */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-emerald-600" />
                      2. Métodos de Formación de Precio
                    </h4>
                    <p className="text-xs text-slate-500">
                      Selecciona la regla matemática para calcular el precio base antes de impuestos.
                    </p>
                  </div>
                </div>

                {/* 4 Method selector buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'markup',
                      title: 'Markup sobre Costo',
                      formula: 'Costo Real × (1 + Margen%)',
                      desc: 'Margen estándar sobre el costo de adquisición.',
                    },
                    {
                      id: 'margin_on_sale',
                      title: 'Margen sobre Venta',
                      formula: 'Costo Real / (1 - Margen%)',
                      desc: 'Garantiza el porcentaje deseado sobre el PVP final.',
                    },
                    {
                      id: 'gap_system',
                      title: 'Sistema de Brecha',
                      formula: 'Costo Real × (1 + Margen%) × (1 + Brecha%)',
                      desc: 'Añade factor de amortiguación o inflación.',
                    },
                    {
                      id: 'manual',
                      title: 'Precio Manual Directo',
                      formula: 'Entrada de precio fija',
                      desc: 'Fijación directa del PVP por el usuario.',
                    },
                  ].map((m) => {
                    const isSelected = pricingMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPricingMethod(m.id as PricingMethod)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-400 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-bold text-xs ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                              {m.title}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 block leading-tight font-bold">
                            {m.formula}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2 block">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Inputs according to selected pricingMethod */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {pricingMethod !== 'manual' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs flex items-center justify-between">
                          <span>Margen de Ganancia (%) *</span>
                          <span className="text-emerald-600 font-mono font-bold">%</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={profitMarginPercentStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setProfitMarginPercentStr(e.target.value);
                              }
                            }}
                            placeholder="30"
                            className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg font-mono font-bold text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                          <span className="absolute right-3 top-2 text-emerald-600 font-bold text-xs">%</span>
                        </div>
                      </div>
                    )}

                    {pricingMethod === 'gap_system' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs flex items-center justify-between">
                          <span>Porcentaje de Brecha (%) *</span>
                          <span className="text-blue-600 font-mono font-bold">%</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={gapPercentStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setGapPercentStr(e.target.value);
                              }
                            }}
                            placeholder="10"
                            className="w-full px-3 py-1.5 border border-blue-300 rounded-lg font-mono font-bold text-blue-900 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <span className="absolute right-3 top-2 text-blue-600 font-bold text-xs">%</span>
                        </div>
                      </div>
                    )}

                    {pricingMethod === 'manual' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs">
                          Precio Base Manual (USD) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-400 font-bold">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualPriceUSDStr}
                            onChange={(e) => {
                              if (isValidDecimalInput(e.target.value)) {
                                setManualPriceUSDStr(e.target.value);
                              }
                            }}
                            placeholder="13.00"
                            className="w-full pl-6 pr-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Base price preview */}
                    <div className="flex flex-col justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600">Precio Base Sin IVA:</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatUSD(calculatedBasePriceUSD)} USD
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SECCIÓN: PARÁMETROS FISCALES (I.V.A.) */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-600" />
                    3. Parámetros Fiscales (Alícuota de I.V.A.)
                  </h4>
                  <span className="text-[10px] text-slate-500">SENIAT Venezuela</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { rate: 16, label: '16% Alícuota General', badge: 'Grava IVA 16%', desc: 'Bebidas, víveres procesados, licores, limpieza' },
                    { rate: 8, label: '8% Alícuota Reducida', badge: 'IVA Reducido 8%', desc: 'Bienes con tratamiento fiscal especial' },
                    { rate: 0, label: '0% Exento de IVA', badge: 'Exento de Ley', desc: 'Cesta básica, queso, harina, leche, carne' },
                  ].map((tax) => {
                    const isSelected = ivaRate === tax.rate;
                    return (
                      <button
                        key={tax.rate}
                        type="button"
                        onClick={() => setIvaRate(tax.rate)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? tax.rate > 0
                              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400 shadow-xs'
                              : 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400 shadow-xs'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-900">{tax.label}</span>
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                tax.rate > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {tax.badge}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">{tax.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. SECCIÓN: PANEL DE RESULTADOS EN VIVO */}
              <div className="p-4 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl text-white shadow-xl space-y-3 border border-indigo-700/50">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <h4 className="font-bold text-sm tracking-wide">Panel de Resultados en Vivo</h4>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-200 bg-white/10 px-2.5 py-0.5 rounded-full">
                    Tasa BCV Activa: {formatPlainNumber(settings.bcvRate, 2)} Bs/$
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                  {/* Costo Real */}
                  <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs border border-white/10">
                    <span className="text-[10px] text-indigo-200 block font-medium">Costo Real</span>
                    <span className="font-mono font-black text-sm block mt-0.5">{formatUSD(realCostUSD)}</span>
                    <span className="text-[10px] text-slate-300 font-mono">
                      {formatBs(realCostUSD * settings.bcvRate)}
                    </span>
                  </div>

                  {/* Ganancia Bruta */}
                  <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs border border-white/10">
                    <span className="text-[10px] text-emerald-300 block font-medium">
                      Ganancia ({formatPlainNumber(effectiveProfitPercent, 1)}%)
                    </span>
                    <span className="font-mono font-black text-sm text-emerald-400 block mt-0.5">
                      +{formatUSD(grossProfitUSD)}
                    </span>
                    <span className="text-[10px] text-emerald-200 font-mono">
                      +{formatBs(grossProfitUSD * settings.bcvRate)}
                    </span>
                  </div>

                  {/* Precio Base Sin IVA */}
                  <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs border border-white/10">
                    <span className="text-[10px] text-indigo-200 block font-medium">Base Sin IVA</span>
                    <span className="font-mono font-black text-sm block mt-0.5">
                      {formatUSD(calculatedBasePriceUSD)}
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono">
                      {formatBs(calculatedBasePriceUSD * settings.bcvRate)}
                    </span>
                  </div>

                  {/* Precio Final USD */}
                  <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-400/40">
                    <span className="text-[10px] text-emerald-300 block font-bold">PVP Final (USD)</span>
                    <span className="font-mono font-black text-base text-emerald-300 block mt-0.5">
                      {formatUSD(finalPriceUSD)}
                    </span>
                    <span className="text-[10px] text-emerald-200">
                      {ivaRate > 0 ? `Incluye +${ivaRate}% IVA` : 'Exento de IVA'}
                    </span>
                  </div>

                  {/* Precio Final Bs */}
                  <div className="bg-amber-500/20 p-2.5 rounded-xl border border-amber-400/40 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-amber-300 block font-bold">PVP Final (Bs.)</span>
                    <span className="font-mono font-black text-base text-amber-300 block mt-0.5">
                      {formatBs(finalPriceUSD * settings.bcvRate)}
                    </span>
                    <span className="text-[10px] text-amber-200">Sincronizado BCV</span>
                  </div>
                </div>
              </div>

              {/* 5. SECCIÓN: MATRIZ DE LISTAS DE PRECIOS ALTERNATIVOS */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-600" />
                      5. Precios Alternativos (Matriz de Listas Comerciales)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configura márgenes específicos para listas de clientes: Público, Mayorista, Distribuidor y Especial.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Lista de Precios</th>
                        <th className="py-2.5 px-3">Margen Ganancia (%)</th>
                        <th className="py-2.5 px-3 text-right">Precio Final (USD)</th>
                        <th className="py-2.5 px-3 text-right">Precio Final (Bs.)</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* 1. Público / Detal */}
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Público / Detal
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="relative w-28">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={matrixPublicoMarginStr}
                              onChange={(e) => {
                                if (isValidDecimalInput(e.target.value)) setMatrixPublicoMarginStr(e.target.value);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
                            />
                            <span className="absolute right-2 top-1 text-slate-400 font-bold text-[10px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatUSD(matrixListsCalculated.publico.priceUSD)} USD
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-bold">
                          {formatBs(matrixListsCalculated.publico.priceBs)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={matrixActive.publico}
                              onChange={(e) => setMatrixActive((p) => ({ ...p, publico: e.target.checked }))}
                              className="rounded text-emerald-600"
                            />
                          </label>
                        </td>
                      </tr>

                      {/* 2. Mayorista */}
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Mayorista
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="relative w-28">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={matrixMayoristaMarginStr}
                              onChange={(e) => {
                                if (isValidDecimalInput(e.target.value)) setMatrixMayoristaMarginStr(e.target.value);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
                            />
                            <span className="absolute right-2 top-1 text-slate-400 font-bold text-[10px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                          {formatUSD(matrixListsCalculated.mayorista.priceUSD)} USD
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-bold">
                          {formatBs(matrixListsCalculated.mayorista.priceBs)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={matrixActive.mayorista}
                              onChange={(e) => setMatrixActive((p) => ({ ...p, mayorista: e.target.checked }))}
                              className="rounded text-blue-600"
                            />
                          </label>
                        </td>
                      </tr>

                      {/* 3. Distribuidor */}
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            Distribuidor
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="relative w-28">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={matrixDistribuidorMarginStr}
                              onChange={(e) => {
                                if (isValidDecimalInput(e.target.value)) setMatrixDistribuidorMarginStr(e.target.value);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
                            />
                            <span className="absolute right-2 top-1 text-slate-400 font-bold text-[10px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700">
                          {formatUSD(matrixListsCalculated.distribuidor.priceUSD)} USD
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-bold">
                          {formatBs(matrixListsCalculated.distribuidor.priceBs)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={matrixActive.distribuidor}
                              onChange={(e) => setMatrixActive((p) => ({ ...p, distribuidor: e.target.checked }))}
                              className="rounded text-purple-600"
                            />
                          </label>
                        </td>
                      </tr>

                      {/* 4. Especial / VIP */}
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Especial / VIP
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="relative w-28">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={matrixEspecialMarginStr}
                              onChange={(e) => {
                                if (isValidDecimalInput(e.target.value)) setMatrixEspecialMarginStr(e.target.value);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
                            />
                            <span className="absolute right-2 top-1 text-slate-400 font-bold text-[10px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                          {formatUSD(matrixListsCalculated.especial.priceUSD)} USD
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-bold">
                          {formatBs(matrixListsCalculated.especial.priceBs)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={matrixActive.especial}
                              onChange={(e) => setMatrixActive((p) => ({ ...p, especial: e.target.checked }))}
                              className="rounded text-amber-600"
                            />
                          </label>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ==================== TAB 3: INVENTARIO ==================== */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-start gap-3">
                <Warehouse className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-950 text-sm">Control Físico y Parámetros de Almacenamiento</h4>
                  <p className="text-indigo-800 text-xs mt-0.5">
                    Establece los niveles de seguridad, límites máximos, puntos de reorden para compras y la localización en estantería.
                  </p>
                </div>
              </div>

              {/* Parámetros de Stock */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Niveles de Existencias y Puntos de Control
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Stock Inicial */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Stock Inicial</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={initialStockStr}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) setInitialStockStr(e.target.value);
                      }}
                      placeholder="50"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Existencia al iniciar operaciones</p>
                  </div>

                  {/* Stock Actual Físico */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Stock Actual Disponible *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isComposite}
                      value={isComposite ? String(compositeVirtualStock) : stockStr}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) setStockStr(e.target.value);
                      }}
                      placeholder="50"
                      className={`w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-sm ${
                        isComposite ? 'bg-purple-50 text-purple-900 border-purple-300 cursor-not-allowed' : 'border-slate-300'
                      }`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {isComposite ? `Virtual (${compositeVirtualStock} combos)` : 'Disponible para la venta'}
                    </p>
                  </div>

                  {/* Stock Mínimo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Stock Mínimo (Alerta)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={minStockStr}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) setMinStockStr(e.target.value);
                      }}
                      placeholder="10"
                      className="w-full px-3 py-1.5 border border-rose-300 rounded-lg font-mono font-bold text-rose-800 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Dispara advertencia en POS y compras</p>
                  </div>

                  {/* Stock Máximo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Stock Máximo (Tope)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={maxStockStr}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) setMaxStockStr(e.target.value);
                      }}
                      placeholder="200"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Capacidad máxima de bodega</p>
                  </div>
                </div>
              </div>

              {/* Punto de Reorden y Ubicación Física */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Punto de reorden */}
                <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    Punto de Reorden Sugerido
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={reorderPointStr}
                    onChange={(e) => {
                      if (e.target.value === '' || /^\d+$/.test(e.target.value)) setReorderPointStr(e.target.value);
                    }}
                    placeholder="20"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">Nivel de unidades en el que debe generarse orden de compra.</p>
                </div>

                {/* Almacén */}
                <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Warehouse className="w-4 h-4 text-indigo-600" />
                    Almacén Asignado
                  </label>
                  <select
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
                  >
                    <option value="Principal">Almacén Principal</option>
                    <option value="Secundario">Almacén Secundario</option>
                    <option value="Depósito">Depósito Central</option>
                    <option value="Piso de Venta">Piso de Venta / Góndola</option>
                  </select>
                  <p className="text-[10px] text-slate-400">Depósito o bodega física donde reposa la mercancía.</p>
                </div>

                {/* Ubicación Física (Pasillo/Estante) */}
                <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    Ubicación Física (Pasillo/Estante)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Pasillo 3 - Estante B - Nivel 2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400">Identificador para agilizar el picking y despacho.</p>
                </div>
              </div>

            </div>
          )}

          {/* ==================== TAB 4: PRESENTACIONES Y UNIDADES DE VENTA ==================== */}
          {activeTab === 'presentations' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Presentación Principal, Contenido y Factores */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Presentación Principal y Conversión
                  </h4>
                  <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-full">
                    Unidades & Empaque
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Presentación Principal */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Presentación Principal *</label>
                    <select
                      value={mainPresentation}
                      onChange={(e) => setMainPresentation(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
                    >
                      <option value="Unidad">Unidad</option>
                      <option value="Caja">Caja</option>
                      <option value="Paquete">Paquete</option>
                      <option value="Botella">Botella</option>
                      <option value="Litro">Litro</option>
                      <option value="Kg">Kilogramo (Kg)</option>
                      <option value="Metro">Metro</option>
                      <option value="Bulto">Bulto</option>
                      <option value="Display">Display</option>
                    </select>
                  </div>

                  {/* Contenido */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Contenido Unitario *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={contentQuantityStr}
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value)) setContentQuantityStr(e.target.value);
                      }}
                      placeholder="1"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>

                  {/* Unidad Base */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Unidad Base *</label>
                    <input
                      type="text"
                      value={baseUnit}
                      onChange={(e) => setBaseUnit(e.target.value)}
                      placeholder="Unidad, ml, gramos, etc."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-800"
                    />
                  </div>

                  {/* Factor de Conversión */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Factor de Conversión *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={conversionFactorStr}
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value)) setConversionFactorStr(e.target.value);
                      }}
                      placeholder="1"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-indigo-700"
                    />
                  </div>
                </div>
              </div>

              {/* MODALIDADES PERMITIDAS CON CASILLAS DE VERIFICACIÓN */}
              <div className="p-4 bg-gradient-to-r from-amber-50/70 to-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    Modalidades de Venta Permitidas (Casillas de Verificación)
                  </h4>
                  <span className="text-[10px] text-slate-500">Habilitación en Caja POS & Tienda Online</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Modalidad 1: Presentación original */}
                  <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={allowedModes.originalPresentation}
                      onChange={(e) => setAllowedModes((p) => ({ ...p, originalPresentation: e.target.checked }))}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">📦 Presentación Original</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Permite despachar el empaque cerrado completo (Caja, Paquete, Bulto).
                      </span>
                    </div>
                  </label>

                  {/* Modalidad 2: Unidad */}
                  <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={allowedModes.unit}
                      onChange={(e) => setAllowedModes((p) => ({ ...p, unit: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">🏷️ Venta por Unidad</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Permite vender unidades individuales sueltas extraídas del empaque.
                      </span>
                    </div>
                  </label>

                  {/* Modalidad 3: Fraccionada */}
                  <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={allowedModes.fractional}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAllowedModes((p) => ({ ...p, fractional: val }));
                        setIsFractionable(val);
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">🪙 Fraccionada (Monto Libre)</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        El cliente indica cuántos Bs. desea y el sistema despacha el equivalente.
                      </span>
                    </div>
                  </label>

                  {/* Modalidad 4: Tragos / Copas / Shots */}
                  <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={allowedModes.shots}
                      onChange={(e) => setAllowedModes((p) => ({ ...p, shots: e.target.checked }))}
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">🍷 Tragos / Copas / Shots</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Ideal para licorerías y bodegones con venta por servicio o copa.
                      </span>
                    </div>
                  </label>

                  {/* Modalidad 5: Control por Contenido / Balanza */}
                  <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400 transition shadow-2xs sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={allowedModes.contentControl}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAllowedModes((p) => ({ ...p, contentControl: val }));
                        setIsWeighable(val);
                        if (val && !pricePerKgUSDStr) setPricePerKgUSDStr(formatPlainNumber(finalPriceUSD, 6));
                      }}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">⚖️ Control por Contenido / Balanza (Kg)</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Para charcutería, quesos, embutidos y carnes pesadas en balanza digital.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* PRESENTACIONES ADICIONALES (BULTOS, CAJAS, FARDOS) */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    Presentaciones Comerciales y Empaques Adicionales ({presentations.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">Venta por mayor o bultos</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Nombre Presentación</label>
                    <input
                      type="text"
                      value={newPresName}
                      onChange={(e) => setNewPresName(e.target.value)}
                      placeholder="Caja x 12 un"
                      className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Unidades (Factor)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPresFactorStr}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setNewPresFactorStr(e.target.value);
                          const fac = parseInt(e.target.value) || 1;
                          setNewPresPriceUSDStr(formatPlainNumber(finalPriceUSD * fac * 0.95, 6));
                        }
                      }}
                      placeholder="12"
                      className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Precio Presentación (USD)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newPresPriceUSDStr}
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value)) setNewPresPriceUSDStr(e.target.value);
                      }}
                      placeholder={formatPlainNumber(finalPriceUSD * (parseInt(newPresFactorStr) || 1) * 0.95, 6)}
                      className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-xs font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Código de Barras</label>
                    <input
                      type="text"
                      value={newPresBarcode}
                      onChange={(e) => setNewPresBarcode(e.target.value)}
                      placeholder="759000..."
                      className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddPresentation}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Presentación
                    </button>
                  </div>
                </div>

                {/* List of registered presentations */}
                {presentations.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {presentations.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>Factor: {p.factor} unid.</span>
                            <span>•</span>
                            <span className="font-mono font-bold text-emerald-700">{formatUSD(p.priceUSD)} USD</span>
                            <span>•</span>
                            <span className="font-mono">{formatBs(p.priceUSD * settings.bcvRate)}</span>
                          </div>
                          {p.barcode && <p className="text-[10px] font-mono text-slate-400">Barra: {p.barcode}</p>}
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

          {/* ==================== TAB 5: PROVEEDORES ==================== */}
          {activeTab === 'suppliers' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 flex items-start gap-3">
                <Truck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 space-y-1">
                  <p className="font-bold text-sm">Proveedores del Producto y Regla del Costo Más Alto</p>
                  <p className="text-blue-800">
                    Asocia los distintos proveedores que suministran este artículo. <strong>El sistema tomará automáticamente el costo más alto entre ellos</strong> para blindar tus márgenes de reposición.
                  </p>
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
                        if (isValidDecimalInput(e.target.value)) setSupplierCostUSDStr(e.target.value);
                      }}
                      placeholder="10.00"
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
                      placeholder="7591234567890"
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
                              <td className="py-2.5 px-3 font-bold text-slate-900">{s.supplierName}</td>
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

          {/* ==================== TAB 6: COMBO / KIT COMPUESTO ==================== */}
          {activeTab === 'composite' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-purple-950 text-sm flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-purple-700" />
                    ¿Es este un Producto Compuesto? (Combo / Kit / Cesta)
                  </span>
                  <p className="text-xs text-purple-800">
                    Al activarlo, podrás seleccionar los artículos que componen este paquete. El costo y el stock armable se calcularán automáticamente.
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
                          onClick={() => setCostUSDStr(formatPlainNumber(compositeTotalCostUSD, 6))}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Aplicar costo acumulado ({formatUSD(compositeTotalCostUSD)} USD)
                        </button>
                      )}
                    </div>

                    {compositeComponents.length > 0 && (
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
                                  <td className="py-2.5 px-3 font-bold text-slate-900">
                                    {c.productName}
                                    {p && <span className="text-[10px] text-slate-500 block">Stock: {p.stock} {p.unit}</span>}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold font-mono text-purple-700">x{c.quantity}</td>
                                  <td className="py-2.5 px-3 text-right font-mono">{formatUSD(c.costUSD)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatUSD(subtotal)}</td>
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
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500">
                  <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-sm text-slate-700">Producto Estándar (No Compuesto)</p>
                  <p className="text-xs max-w-sm mx-auto mt-1">
                    Activa el interruptor superior si deseas crear un kit, combo o cesta navideña compuesta por varios artículos.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Resumen:</span>
              <span className="font-bold text-slate-800">
                Costo Real: <strong className="font-mono text-indigo-700">{formatUSD(realCostUSD)}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-emerald-700">
                Margen: {formatPlainNumber(effectiveProfitPercent, 1)}%
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-black text-slate-900 font-mono text-sm">
                PVP: {formatUSD(finalPriceUSD)} USD ({formatBs(finalPriceUSD * settings.bcvRate)})
              </span>
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
