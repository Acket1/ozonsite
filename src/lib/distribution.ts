import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Indices of physical status columns in the Ozon template
const STATUS_COLS = [
  10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26
];
const VIRTUAL_COL = 19; // В заявках на поставку
const TOTAL_COL = 9; // Всего товаров

interface DistributionProfile {
  totalInProfile: number;
  // Map of warehouse name -> Map of status col index -> percentage
  warehouseDistribution: Record<string, Record<number, number>>;
  virtualRatio: number; // Ratio of virtual to total
}

export async function processReports(ozonFile: File, onecFile: File): Promise<void> {
  const ozonBuffer = await ozonFile.arrayBuffer();
  const onecBuffer = await onecFile.arrayBuffer();

  const ozonWb = XLSX.read(ozonBuffer, { type: 'array' });
  const onecWb = XLSX.read(onecBuffer, { type: 'array' });

  const ozonWs = ozonWb.Sheets[ozonWb.SheetNames[0]];
  const onecWs = onecWb.Sheets[onecWb.SheetNames[0]];

  const ozonData = XLSX.utils.sheet_to_json<any[]>(ozonWs, { header: 1 });
  const onecData = XLSX.utils.sheet_to_json<any[]>(onecWs, { header: 1 });

  // 1. Analyze Ozon Template
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, ozonData.length); i++) {
    if (ozonData[i] && ozonData[i][0] === 'Артикул' && ozonData[i][6] === 'Склад') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) throw new Error('Не найдены заголовки в шаблоне Ozon');

  // Rows 0 to headerRowIndex + 1 (usually 'Нередактируемое' row) are preserved
  const headerSection = ozonData.slice(0, headerRowIndex + 2);
  const ozonItems = ozonData.slice(headerRowIndex + 2).filter(row => row && row[0]);

  // Build a global distribution profile
  const globalProfile: DistributionProfile = {
    totalInProfile: 0,
    warehouseDistribution: {},
    virtualRatio: 0
  };

  let totalVirtual = 0;

  for (const row of ozonItems) {
    const warehouse = row[6];
    if (!warehouse) continue;
    
    if (!globalProfile.warehouseDistribution[warehouse]) {
      globalProfile.warehouseDistribution[warehouse] = {};
      for (const col of STATUS_COLS) {
        globalProfile.warehouseDistribution[warehouse][col] = 0;
      }
    }

    const itemTotal = Number(row[TOTAL_COL]) || 0;
    
    for (const col of STATUS_COLS) {
      const val = Number(row[col]) || 0;
      globalProfile.warehouseDistribution[warehouse][col] += val;
      globalProfile.totalInProfile += val; // Sum actual physical statuses
    }

    totalVirtual += Number(row[VIRTUAL_COL]) || 0;
  }

  if (globalProfile.totalInProfile === 0) {
    throw new Error('В шаблоне Ozon нет товаров с ненулевым остатком, невозможно определить пропорции');
  }

  globalProfile.virtualRatio = totalVirtual / globalProfile.totalInProfile;

  // Convert raw sums to percentages
  for (const wh of Object.keys(globalProfile.warehouseDistribution)) {
    for (const col of STATUS_COLS) {
      globalProfile.warehouseDistribution[wh][col] /= globalProfile.totalInProfile;
    }
  }

  // 2. Parse 1C Export
  const parsed1CItems: { article: string; name: string; quantity: number }[] = [];
  
  let onecDataStartIndex = -1;
  let nameColIdx = -1;
  let qtyColIdx = -1;

  for (let i = 0; i < Math.min(30, onecData.length); i++) {
    const row = onecData[i] || [];
    const nameIdx = row.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('номенклатура'));
    const qIdx = row.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('количество'));
    
    if (nameIdx !== -1 && qIdx !== -1) {
      nameColIdx = nameIdx;
      qtyColIdx = qIdx;
      onecDataStartIndex = i + 1;
      break;
    }
  }

  if (onecDataStartIndex === -1) {
    throw new Error('Не удалось найти колонки "Номенклатура" и "Количество" в файле 1С');
  }

  for (let i = onecDataStartIndex; i < onecData.length; i++) {
    const row = onecData[i];
    if (!row || !row[nameColIdx]) continue;
    
    const nameRaw = String(row[nameColIdx]);
    // Skip group folders
    if (nameRaw.includes('Ozon') || nameRaw.includes('Wildberries') || !row[qtyColIdx]) continue;
    
    const quantity = Number(row[qtyColIdx]);
    if (isNaN(quantity) || quantity <= 0) continue;

    // Try to extract article (usually after the last comma)
    let name = nameRaw;
    let article = nameRaw;
    const lastCommaIdx = nameRaw.lastIndexOf(',');
    if (lastCommaIdx !== -1) {
      article = nameRaw.substring(lastCommaIdx + 1).trim();
      name = nameRaw.substring(0, lastCommaIdx).trim();
    } else {
      // Fallback: extract first word if it looks like article, or just use the whole string
      const firstWord = nameRaw.split(' ')[0];
      article = firstWord;
    }

    parsed1CItems.push({ article, name, quantity });
  }

  if (parsed1CItems.length === 0) {
    throw new Error('Не найдено ни одного товара с остатками в файле 1С');
  }

  // 3. Generate New Rows
  const outputRows: any[][] = [];

  for (const item of parsed1CItems) {
    let remainingQuantity = item.quantity;
    
    // To handle remainder, we keep track of fractional parts
    const fractions: { wh: string, col: number, frac: number }[] = [];
    
    // We will build rows per warehouse
    const itemRows: Record<string, any[]> = {};
    const warehouses = Object.keys(globalProfile.warehouseDistribution);

    // Prepare template row based on first data row of Ozon template to copy static fields like "Признак товара"
    const sampleRow = ozonItems[0] ? [...ozonItems[0]] : [];
    
    for (const wh of warehouses) {
      const newRow = [...sampleRow];
      // Clear out numbers
      for (let i = 0; i < 30; i++) {
        if (typeof newRow[i] === 'number') newRow[i] = 0;
      }
      
      newRow[0] = item.article;
      newRow[1] = item.name;
      newRow[2] = item.article; // SKU - just duplicate article for now
      newRow[6] = wh; // Склад
      
      let whTotal = 0;

      for (const col of STATUS_COLS) {
        const exactVal = item.quantity * globalProfile.warehouseDistribution[wh][col];
        const intVal = Math.floor(exactVal);
        const fracVal = exactVal - intVal;
        
        newRow[col] = intVal;
        whTotal += intVal;
        
        if (fracVal > 0) {
          fractions.push({ wh, col, frac: fracVal });
        }
      }
      
      itemRows[wh] = newRow;
      remainingQuantity -= whTotal;
    }
    
    // Distribute remainder
    fractions.sort((a, b) => b.frac - a.frac);
    let fIdx = 0;
    while (remainingQuantity > 0 && fIdx < fractions.length) {
      const { wh, col } = fractions[fIdx];
      itemRows[wh][col] += 1;
      remainingQuantity -= 1;
      fIdx++;
    }

    // Now calculate Total and Virtual for each warehouse
    for (const wh of warehouses) {
      const row = itemRows[wh];
      let rowPhysicalTotal = 0;
      for (const col of STATUS_COLS) {
        rowPhysicalTotal += row[col];
      }
      
      row[TOTAL_COL] = rowPhysicalTotal;
      
      // Virtual (В заявках на поставку)
      row[VIRTUAL_COL] = Math.floor(rowPhysicalTotal * globalProfile.virtualRatio);
      
      // Only push rows that have SOME physical goods
      if (rowPhysicalTotal > 0) {
        outputRows.push(row);
      }
    }
  }

  // Combine and export
  const finalData = [...headerSection, ...outputRows];
  const newWs = XLSX.utils.aoa_to_sheet(finalData);
  
  // Set column widths: wide for text/headers, narrow for numbers
  const wsCols = [
    { wch: 15 }, // 0: Артикул
    { wch: 55 }, // 1: Название товара
    { wch: 15 }, // 2: SKU
    { wch: 20 }, // 3: Признак товара
    { wch: 25 }, // 4: Зона размещения
    { wch: 15 }, // 5: Кластер
    { wch: 30 }, // 6: Склад
    { wch: 15 }, // 7: Плата
    { wch: 12 }, // 8: Кол-во платно
    { wch: 10 }, // 9: Всего товаров
  ];
  // 10 to 29 are number columns (statuses)
  for (let i = 10; i < 30; i++) {
    wsCols.push({ wch: 10 });
  }
  newWs['!cols'] = wsCols;

  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, newWs, 'Остатки');
  
  const outBuffer = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
  
  saveAs(blob, 'Сгенерированный_Отчет_Ozon.xlsx');
}
