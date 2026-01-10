import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Upload, BookOpen, Moon, Sun, Bookmark, BookmarkCheck, Maximize, MinusSquare, Hash } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - correct worker setup for Vercel/CRA
// Use CDN that dynamically matches the installed pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function App() {
  const [pdfData, setPdfData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null);
  const [theme, setTheme] = useState('light');
  const [bookmarks, setBookmarks] = useState([]);
  const [pageInput, setPageInput] = useState('');
  const [showPageJump, setShowPageJump] = useState(false);
  const [fitMode, setFitMode] = useState('auto');
  const [pdfName, setPdfName] = useState('');

  const currentCanvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pageInputRef = useRef(null);



  useEffect(() => {
    if (pdfData && pdfName) {
      localStorage.setItem('flipped_last_position', JSON.stringify({
        page: currentPage,
        pdfName: pdfName
      }));
    }
  }, [currentPage, pdfData, pdfName]);

  const loadPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        // Prevents CORS/worker surprises
        disableAutoFetch: true,
        disableStream: true,
      });
      const pdf = await loadingTask.promise;

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setPdfData(uint8Array);
      setPdfName(file.name);

      const savedPosition = localStorage.getItem('flipped_last_position');
      if (savedPosition) {
        const { page, pdfName: savedPdfName } = JSON.parse(savedPosition);
        if (savedPdfName === file.name && page <= pdf.numPages) {
          setCurrentPage(page);
        } else {
          setCurrentPage(1);
        }
      } else {
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Failed to load PDF: ' + (error?.message || 'Unknown error'));
    }
  };

  const getScaleForFitMode = useCallback((page, viewport) => {
    if (!containerRef.current) return scale;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 64;
    const containerHeight = container.clientHeight - 200; 

    if (fitMode === 'width') {
      return containerWidth / viewport.width;
    } else if (fitMode === 'height') {
      return containerHeight / viewport.height;
    }
    return scale;
  }, [fitMode, scale]);

  const renderPage = useCallback(async (pageNum, canvas) => {
    if (!pdfDoc || !canvas) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      let viewport = page.getViewport({ scale: 1.0 });

      const finalScale = fitMode === 'auto' ? scale : getScaleForFitMode(page, viewport);
      viewport = page.getViewport({ scale: finalScale });

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [pdfDoc, fitMode, scale, getScaleForFitMode]);

  useEffect(() => {
    if (pdfDoc && currentCanvasRef.current && !isFlipping) {
      renderPage(currentPage, currentCanvasRef.current);
    }
  }, [currentPage, scale, pdfDoc, isFlipping, fitMode, renderPage]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      loadPDF(file);
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  const flipPage = useCallback(async (direction, targetPage = null) => {
    if (isFlipping) return;

    const newPage = targetPage || (direction === 'next' ? currentPage + 1 : currentPage - 1);
    if (newPage < 1 || newPage > totalPages) return;

    setIsFlipping(true);
    setFlipDirection(direction);

    if (nextCanvasRef.current) {
      await renderPage(newPage, nextCanvasRef.current);
    }

    setTimeout(() => {
      setCurrentPage(newPage);
      setIsFlipping(false);
      setFlipDirection(null);
    }, 600);
  }, [isFlipping, currentPage, totalPages, renderPage]);

  const goToNextPage = useCallback(() => flipPage('next'), [flipPage]);
  const goToPrevPage = useCallback(() => flipPage('prev'), [flipPage]);

  const handlePageJump = (e) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput);
    if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
      const direction = pageNum > currentPage ? 'next' : 'prev';
      flipPage(direction, pageNum);
      setShowPageJump(false);
      setPageInput('');
    }
  };

  const zoomIn = () => {
    setFitMode('auto');
    setScale(Math.min(scale + 0.2, 3.0));
  };

  const zoomOut = () => {
    setFitMode('auto');
    setScale(Math.max(scale - 0.2, 0.5));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const toggleBookmark = useCallback(() => {
    if (bookmarks.includes(currentPage)) {
      setBookmarks(bookmarks.filter(page => page !== currentPage));
    } else {
      setBookmarks([...bookmarks, currentPage].sort((a, b) => a - b));
    }
  }, [bookmarks, currentPage]);

  const handleKeyPress = useCallback((e) => {
    if (!isFlipping && !showPageJump) {
      if (e.key === 'ArrowRight') goToNextPage();
      if (e.key === 'ArrowLeft') goToPrevPage();
      if (e.key === 'b' || e.key === 'B') toggleBookmark();
      if (e.key === 'g' || e.key === 'G') setShowPageJump(true);
    }
  }, [isFlipping, showPageJump, goToNextPage, goToPrevPage, toggleBookmark]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    if (showPageJump && pageInputRef.current) {
      pageInputRef.current.focus();
    }
  }, [showPageJump]);



  const goToBookmark = (page) => {
    if (page !== currentPage && !isFlipping) {
      const direction = page > currentPage ? 'next' : 'prev';
      flipPage(direction, page);
    }
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'sepia'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeColors = () => {
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-gradient-to-br from-gray-900 to-gray-800',
          header: 'bg-gradient-to-r from-gray-800 to-gray-700 text-white',
          card: 'bg-gray-800 border-gray-600',
          text: 'text-white',
          textMuted: 'text-gray-300',
          control: 'bg-gray-800 border-gray-700',
          button: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
          canvas: 'bg-gray-900',
          canvasFilter: 'brightness(0.9)',
          pageBg: 'bg-gray-800'
        };
      case 'sepia':
        return {
          bg: 'bg-gradient-to-br from-amber-100 to-orange-100',
          header: 'bg-gradient-to-r from-amber-700 to-orange-600 text-white',
          card: 'bg-amber-50 border-amber-300',
          text: 'text-amber-900',
          textMuted: 'text-amber-700',
          control: 'bg-amber-50 border-amber-200',
          button: 'bg-amber-200 text-amber-800 hover:bg-amber-300',
          canvas: 'bg-amber-50',
          canvasFilter: 'sepia(0.3) brightness(1.1)',
          pageBg: 'bg-amber-50'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
          header: 'bg-gradient-to-r from-amber-800 to-orange-700 text-white',
          card: 'bg-white border-amber-300',
          text: 'text-gray-800',
          textMuted: 'text-gray-600',
          control: 'bg-white border-gray-200',
          button: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
          canvas: 'bg-gray-100',
          canvasFilter: 'none',
          pageBg: 'bg-white'
        };
    }
  };

  const colors = getThemeColors();
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark': return <Moon className="w-5 h-5" />;
      case 'sepia': return <BookOpen className="w-5 h-5" />;
      default: return <Sun className="w-5 h-5" />;
    }
  };

  return (
    <div ref={containerRef} className={`h-screen flex flex-col transition-colors duration-300 ${colors.bg}`}>
      <style>{`
        @keyframes flipNext {
          0% { transform: perspective(2000px) rotateY(0deg); transform-origin: right center; opacity: 1; }
          50% { transform: perspective(2000px) rotateY(-90deg); transform-origin: right center; opacity: 0.5; }
          51% { transform: perspective(2000px) rotateY(90deg); transform-origin: right center; opacity: 0.5; }
          100% { transform: perspective(2000px) rotateY(0deg); transform-origin: right center; opacity: 1; }
        }
        @keyframes flipPrev {
          0% { transform: perspective(2000px) rotateY(0deg); transform-origin: left center; opacity: 1; }
          50% { transform: perspective(2000px) rotateY(90deg); transform-origin: left center; opacity: 0.5; }
          51% { transform: perspective(2000px) rotateY(-90deg); transform-origin: left center; opacity: 0.5; }
          100% { transform: perspective(2000px) rotateY(0deg); transform-origin: left center; opacity: 1; }
        }
        .flip-next { animation: flipNext 0.6s ease-in-out; }
        .flip-prev { animation: flipPrev 0.6s ease-in-out; }
        .page-shadow { box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(0, 0, 0, 0.1); }
        @media (max-width: 768px) {
          .control-button { padding: 0.5rem; }
          .control-text { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className={`px-4 md:px-6 py-3 md:py-4 shadow-lg transition-colors duration-300 ${colors.header}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3">
            <BookOpen className="w-6 h-6 md:w-8 md:h-8" />
            <h1 className="text-xl md:text-2xl font-bold">Flipped</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {pdfData && (
              <div className="text-xs md:text-sm bg-white/20 px-2 md:px-4 py-1 md:py-2 rounded-lg backdrop-blur-sm">
                <span className="hidden sm:inline">Page </span>{currentPage}/{totalPages}
              </div>
            )}
            <button onClick={cycleTheme} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
              {getThemeIcon()}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {pdfData && (
        <div className="w-full h-1 bg-black/10">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Main Content */}
      {!pdfData ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="text-center max-w-md w-full">
            <div className={`rounded-2xl shadow-2xl p-8 md:p-12 border-2 border-dashed transition-colors duration-300 ${colors.card}`}>
              <Upload className={`w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 ${theme === 'light' ? 'text-amber-600' : theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`} />
              <h2 className={`text-xl md:text-2xl font-bold mb-3 md:mb-4 ${colors.text}`}>Upload Your Book</h2>
              <p className={`mb-4 md:mb-6 text-sm md:text-base ${colors.textMuted}`}>Select a PDF file and start reading</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 md:px-8 py-2 md:py-3 rounded-lg font-semibold hover:from-amber-700 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg text-sm md:text-base">
                Choose PDF File
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`flex-1 overflow-auto p-4 md:p-8 transition-colors duration-300 ${colors.canvas}`}>
            <div className="flex justify-center items-center min-h-full">
              <div className="relative w-full flex justify-center">
                <div className={`rounded-lg overflow-hidden ${colors.pageBg} ${isFlipping ? flipDirection === 'next' ? 'flip-next' : 'flip-prev' : ''} page-shadow max-w-full`} style={{ transformStyle: 'preserve-3d' }}>
                  <canvas ref={currentCanvasRef} className="max-w-full h-auto block" style={{ backfaceVisibility: 'hidden', filter: colors.canvasFilter }} />
                </div>
                <canvas ref={nextCanvasRef} className="hidden" />
              </div>
            </div>
          </div>

          {/* Page Jump Modal */}
          {showPageJump && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className={`rounded-xl shadow-2xl p-6 max-w-sm w-full ${colors.card}`}>
                <h3 className={`text-lg font-bold mb-4 ${colors.text}`}>Jump to Page</h3>
                <form onSubmit={handlePageJump}>
                  <input ref={pageInputRef} type="number" min="1" max={totalPages} value={pageInput} onChange={(e) => setPageInput(e.target.value)} placeholder={`1 - ${totalPages}`} className={`w-full px-4 py-2 rounded-lg border-2 mb-4 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : theme === 'sepia' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-gray-300 text-gray-900'}`} />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white py-2 rounded-lg font-semibold hover:from-amber-700 hover:to-orange-700">Go</button>
                    <button type="button" onClick={() => { setShowPageJump(false); setPageInput(''); }} className={`flex-1 py-2 rounded-lg font-semibold ${colors.button}`}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={`border-t px-3 md:px-6 py-3 md:py-4 shadow-lg transition-colors duration-300 ${colors.control}`}>
            <div className="flex flex-wrap items-center justify-between max-w-7xl mx-auto gap-2">
              <div className="flex items-center gap-1 md:gap-2">
                <button onClick={goToPrevPage} disabled={currentPage === 1 || isFlipping} className="control-button p-2 md:p-3 rounded-lg bg-amber-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-amber-700 transition-colors">
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={goToNextPage} disabled={currentPage === totalPages || isFlipping} className="control-button p-2 md:p-3 rounded-lg bg-amber-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-amber-700 transition-colors">
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={() => setShowPageJump(true)} className={`control-button p-2 md:p-3 rounded-lg transition-colors ${colors.button}`}>
                  <Hash className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <button onClick={zoomOut} disabled={isFlipping || fitMode !== 'auto'} className={`control-button p-2 md:p-3 rounded-lg transition-colors disabled:opacity-50 ${colors.button}`}>
                  <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <span className={`text-xs md:text-sm font-medium min-w-[50px] md:min-w-[60px] text-center ${colors.text}`}>
                  {fitMode === 'auto' ? `${Math.round(scale * 100)}%` : fitMode === 'width' ? 'Width' : 'Height'}
                </span>
                <button onClick={zoomIn} disabled={isFlipping || fitMode !== 'auto'} className={`control-button p-2 md:p-3 rounded-lg transition-colors disabled:opacity-50 ${colors.button}`}>
                  <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={() => setFitMode(fitMode === 'width' ? 'height' : 'width')} className={`control-button p-2 md:p-3 rounded-lg transition-colors ${colors.button}`}>
                  {fitMode === 'width' ? <MinusSquare className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5" />}
                </button>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <button onClick={toggleBookmark} className={`control-button p-2 md:p-3 rounded-lg transition-colors ${bookmarks.includes(currentPage) ? 'bg-amber-600 text-white hover:bg-amber-700' : colors.button}`}>
                  {bookmarks.includes(currentPage) ? <BookmarkCheck className="w-4 h-4 md:w-5 md:h-5" /> : <Bookmark className="w-4 h-4 md:w-5 md:h-5" />}
                </button>

                {bookmarks.length > 0 && (
                  <div className="relative group">
                    <button className={`control-button px-2 md:px-3 py-2 md:py-3 rounded-lg transition-colors font-medium text-xs md:text-sm ${colors.button}`}>
                      {bookmarks.length} 📑
                    </button>
                    <div className={`absolute bottom-full right-0 mb-2 w-40 md:w-48 rounded-lg shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${theme === 'dark' ? 'bg-gray-700' : theme === 'sepia' ? 'bg-amber-50' : 'bg-white'}`}>
                      <div className={`px-3 py-2 text-xs md:text-sm font-semibold border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : theme === 'sepia' ? 'bg-amber-100 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        Bookmarks
                      </div>
                      <div className="max-h-48 md:max-h-60 overflow-y-auto">
                        {bookmarks.map((page) => (
                          <button key={page} onClick={() => goToBookmark(page)} className={`w-full text-left px-3 py-2 text-xs md:text-sm transition-colors flex items-center justify-between ${page === currentPage ? 'bg-amber-100 text-amber-900 font-semibold' : theme === 'dark' ? 'text-gray-300 hover:bg-gray-600' : theme === 'sepia' ? 'text-amber-800 hover:bg-amber-100' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <span>Page {page}</span>
                            {page === currentPage && <span className="text-xs">•</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={toggleFullscreen} className={`control-button p-2 md:p-3 rounded-lg transition-colors ${colors.button}`}>
                  <Maximize2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={() => { setPdfData(null); setPdfDoc(null); setCurrentPage(1); setTotalPages(0); setScale(1.0); setBookmarks([]); setPdfName(''); }} className="control-button px-3 md:px-4 py-2 md:py-3 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors font-medium text-sm md:text-sm">
                  <span className="control-text">New Book</span>
                  <span className="md:hidden">📕</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}