import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Play, AlertCircle, CheckCircle2, FileX, ArrowRight, Settings2, Info } from 'lucide-react';
import { processReports } from './lib/distribution';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [ozonFile, setOzonFile] = useState<File | null>(null);
  const [onecFile, setOnecFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [dragActiveOzon, setDragActiveOzon] = useState(false);
  const [dragActiveOnec, setDragActiveOnec] = useState(false);

  const handleGenerate = async () => {
    if (!ozonFile || !onecFile) return;
    
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);
    
    try {
      await processReports(ozonFile, onecFile);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Произошла ошибка при генерации отчета.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent, setDragActive: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, setFile: (file: File) => void, setDragActive: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const FileZone = ({ 
    title, 
    description, 
    file, 
    setFile, 
    dragActive, 
    setDragActive 
  }: { 
    title: string, 
    description: string, 
    file: File | null, 
    setFile: (file: File | null) => void,
    dragActive: boolean,
    setDragActive: (val: boolean) => void
  }) => (
    <div 
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
        file ? 'bg-zinc-50 border-zinc-200' : 
        dragActive ? 'bg-blue-50 border-blue-400' : 'bg-white border-zinc-200 hover:border-zinc-300'
      }`}
      onDragEnter={(e) => handleDrag(e, setDragActive)}
      onDragLeave={(e) => handleDrag(e, setDragActive)}
      onDragOver={(e) => handleDrag(e, setDragActive)}
      onDrop={(e) => handleDrop(e, (f) => setFile(f), setDragActive)}
    >
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[220px]"
          >
            <div className={`p-4 rounded-full mb-4 transition-colors ${dragActive ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-500'}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 mb-1">{title}</h3>
            <p className="text-sm text-zinc-500 mb-4 max-w-[200px] text-balance leading-relaxed">
              {description}
            </p>
            <label className="relative cursor-pointer">
              <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-sm">
                Выбрать файл
              </span>
              <input 
                type="file" 
                accept=".xlsx, .xls"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0]);
                    setError(null);
                  }
                }}
              />
            </label>
          </motion.div>
        ) : (
          <motion.div 
            key="filled"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[220px]"
          >
            <div className="p-4 rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 mb-1 line-clamp-1 break-all" title={file.name}>
              {file.name}
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              {(file.size / 1024).toFixed(1)} KB • Готов к работе
            </p>
            <button 
              onClick={() => setFile(null)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
            >
              <FileX className="w-4 h-4" />
              Удалить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 py-6 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Симулятор Ozon</h1>
              <p className="text-sm text-zinc-500">Генератор распределения остатков</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
          
          {/* Main Action Area */}
          <div className="space-y-6">
            <div className="bg-white p-2 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="p-6 md:p-8 space-y-8">
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Загрузка данных</h2>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    Загрузите шаблон отчета Ozon и файл с остатками из 1С. Алгоритм автоматически рассчитает пропорции распределения и сгенерирует объединенный файл.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 relative">
                  <FileZone 
                    title="Шаблон Ozon"
                    description="Эталонный отчет с текущим распределением товаров"
                    file={ozonFile}
                    setFile={setOzonFile}
                    dragActive={dragActiveOzon}
                    setDragActive={setDragActiveOzon}
                  />
                  <FileZone 
                    title="Остатки 1С"
                    description="Выгрузка со 137 товарами и общим количеством"
                    file={onecFile}
                    setFile={setOnecFile}
                    dragActive={dragActiveOnec}
                    setDragActive={setDragActiveOnec}
                  />
                  {/* Decorative arrow in the middle on desktop */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-zinc-200 rounded-full hidden md:flex items-center justify-center text-zinc-400 shadow-sm z-10">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>

                <AnimatePresence mode="popLayout">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-800"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                      <p className="leading-relaxed">{error}</p>
                    </motion.div>
                  )}

                  {isSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 text-sm text-emerald-800"
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                      <p className="leading-relaxed">Отчет успешно сгенерирован и загружен на ваше устройство!</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  disabled={!ozonFile || !onecFile || isLoading}
                  onClick={handleGenerate}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 focus:ring-4 focus:ring-zinc-900/10 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-all shadow-sm disabled:shadow-none"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  {isLoading ? 'Идет расчет и генерация...' : 'Запустить распределение'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar / Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-zinc-900 font-medium">
                <Info className="w-5 h-5 text-zinc-400" />
                <h3>Как это работает</h3>
              </div>
              
              <div className="space-y-5">
                <div className="relative pl-6 before:absolute before:left-[7px] before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-zinc-100 last:before:hidden">
                  <span className="absolute left-0 top-1 w-4 h-4 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">1</span>
                  <h4 className="text-sm font-semibold text-zinc-900">Анализ шаблона</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Система вычисляет эталонные пропорции товаров по складам и статусам на основе файла Ozon.</p>
                </div>
                
                <div className="relative pl-6 before:absolute before:left-[7px] before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-zinc-100 last:before:hidden">
                  <span className="absolute left-0 top-1 w-4 h-4 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">2</span>
                  <h4 className="text-sm font-semibold text-zinc-900">Математика остатков</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Товары из 1С распределяются целыми числами. Дроби переносятся туда, где нехватка максимальна, чтобы сумма сошлась 1 к 1.</p>
                </div>

                <div className="relative pl-6 before:absolute before:left-[7px] before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-zinc-100 last:before:hidden">
                  <span className="absolute left-0 top-1 w-4 h-4 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">3</span>
                  <h4 className="text-sm font-semibold text-zinc-900">Виртуальные заявки</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Статус «В заявках на поставку» рассчитывается отдельным коэффициентом и исключается из столбца «Всего товаров».</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-zinc-400">
              Локальная обработка данных.<br/>Файлы не отправляются на сервер.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

