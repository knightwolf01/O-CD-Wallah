import React, { useEffect, useRef, useState } from 'react';
import { Download, Code, Folder, FileText, Play, Trash2, Settings, Eye, EyeOff, Monitor, AlertCircle } from 'lucide-react';


const defaultExamplePrompts = [
  "Create a modern portfolio website for a photographer",
  "Build a responsive calculator app with dark theme",
  "Design a landing page for a restaurant with menu",
  "Create a todo list app with local storage",
  "Build a weather app interface",
];

function extractFilesFromAIResponse(text) {

  const files = {};
  const codeBlockRegex = /```(?:(\w+)\s*\n)?([\s\S]*?)```/g;
  let m;
  while ((m = codeBlockRegex.exec(text)) !== null) {
    const lang = m[1]?.toLowerCase() || '';
    let body = m[2].trim();

   
    let filename = '';
    const firstLines = body.split(/\r?\n/).slice(0, 3).join('\n');

    const hintMatch =
      firstLines.match(/(?:<!--\s*([\w\-\._]+(?:\.\w+))\s*-->)/) ||
      firstLines.match(/\/\/\s*([\w\-\._]+(?:\.\w+))/) ||
      firstLines.match(/\/\*\s*([\w\-\._]+(?:\.\w+))\s*\*\//) ||
      firstLines.match(/#\s*([\w\-\._]+(?:\.\w+))/);

    if (hintMatch) filename = hintMatch[1];

    if (!filename) {
      if (lang === 'html' || /<!doctype html/i.test(body) || /<html/i.test(body)) filename = 'index.html';
      else if (lang === 'css' || /(^|\s)body\s*\{/.test(body) || /\.[\w-]+\s*\{/.test(body)) filename = 'style.css';
      else if (lang === 'js' || lang === 'javascript' || /document\.|window\.|addEventListener/.test(body)) filename = 'script.js';
    }

    if (!filename) {
      const ext = lang === 'css' ? '.css' : lang === 'html' ? '.html' : lang.startsWith('js') ? '.js' : '.txt';
      let i = 1;
      filename = `file${i}${ext}`;
      while (files[filename]) {
        i += 1;
        filename = `file${i}${ext}`;
      }
    }

    files[filename] = body;
  }

  return files;
}

const NeonParticle = ({ style }) => (
  <div 
    className="absolute rounded-full animate-pulse pointer-events-none select-none"
    style={{
      ...style,
      background: `radial-gradient(circle, ${style.color} 0%, transparent 70%)`,
      animation: `float ${2 + Math.random() * 3}s ease-in-out infinite`,
      boxShadow: `0 0 ${style.size}px ${style.color}`,
    }}
  />
);

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [model, setModel] = useState('gemini-2.5-flash'); // user can change in settings
  const [neonParticles, setNeonParticles] = useState([]);
  const messagesEndRef = useRef(null);

  // Generate neon particles for background animation
  useEffect(() => {
    const colors = ['#ff00ff', '#00ffff', '#ff0080', '#8000ff', '#00ff80', '#ff8000'];
    const particles = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 3 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      animationDelay: Math.random() * 3,
      opacity: 0.3 + Math.random() * 0.7
    }));
    setNeonParticles(particles);
  }, []);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const generatePreviewHTML = () => {
    const htmlFile = generatedFiles['index.html'] || Object.entries(generatedFiles).find(([k]) => k.endsWith('.html'))?.[1];
    const cssFile = generatedFiles['style.css'] || Object.entries(generatedFiles).find(([k]) => k.endsWith('.css'))?.[1];
    const jsFile = generatedFiles['script.js'] || Object.entries(generatedFiles).find(([k]) => k.endsWith('.js'))?.[1];

    if (!htmlFile) return '<html><body><h1>No HTML found</h1></body></html>';

    let preview = htmlFile;

    if (cssFile) {
      // replace link to style.css or inject into head
      if (preview.match(/<link[^>]*href=["'].*style\.css["'][^>]*>/i)) {
        preview = preview.replace(/<link[^>]*href=["'].*style\.css["'][^>]*>/i, `<style>${cssFile}</style>`);
      } else {
        preview = preview.replace(/<\/head>/i, `<style>${cssFile}</style></head>`);
      }
    }

    if (jsFile) {
      if (preview.match(/<script[^>]*src=["'].*script\.js["'][^>]*><\/script>/i)) {
        preview = preview.replace(/<script[^>]*src=["'].*script\.js["'][^>]*><\/script>/i, `<script>${jsFile}<\/script>`);
      } else {
        preview = preview.replace(/<\/body>/i, `<script>${jsFile}<\/script></body>`);
      }
    }

    return preview;
  };

  const parseAIAndSetFiles = (aiText) => {
    const files = extractFilesFromAIResponse(aiText);
    if (Object.keys(files).length === 0) {
      setMessages(prev => [...prev, { type: 'warning', content: 'No files detected in the AI response. Showing raw response.', timestamp: new Date().toLocaleTimeString() }]);
      setMessages(prev => [...prev, { type: 'ai', content: aiText, timestamp: new Date().toLocaleTimeString() }]);
      return;
    }

    setGeneratedFiles(prev => ({ ...prev, ...files }));
    setMessages(prev => [...prev, { type: 'success', content: `✅ Generated ${Object.keys(files).length} files: ${Object.keys(files).join(', ')}`, timestamp: new Date().toLocaleTimeString() }]);
  };

  const callGenerate = async (promptText) => {
    setIsProcessing(true);
    setMessages(prev => [...prev, { type: 'user', content: promptText, timestamp: new Date().toLocaleTimeString() }]);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `You are an expert web developer. Produce full website files (index.html, style.css, script.js) in separate code blocks with filename hints. The user asked: ${promptText}`, model })
      });

      const data = await resp.json();
      if (!resp.ok) {
        setMessages(prev => [...prev, { type: 'error', content: `Server error: ${data?.error || resp.statusText}`, timestamp: new Date().toLocaleTimeString() }]);
        return;
      }

      const aiText = data.text || '';
      setMessages(prev => [...prev, { type: 'ai', content: aiText, timestamp: new Date().toLocaleTimeString() }]);

      parseAIAndSetFiles(aiText);
      setShowPreview(true);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { type: 'error', content: `Request failed: ${err.message}`, timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    callGenerate(input.trim());
    setInput('');
  };

  const downloadFiles = () => {
    if (!Object.keys(generatedFiles).length) {
      alert('No files to download');
      return;
    }
    Object.entries(generatedFiles).forEach(([filename, content]) => {
      const mimeType = filename.endsWith('.html') ? 'text/html' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.js') ? 'text/javascript' : 'text/plain';
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
    alert(`Downloaded ${Object.keys(generatedFiles).length} files`);
  };

  const clearAll = () => {
    setMessages([]);
    setGeneratedFiles({});
    setSelectedFile(null);
    setShowPreview(false);
    setShowFullScreen(false);
  };

  const [showFullScreen, setShowFullScreen] = useState(false);

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes neonPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes neonGlow {
          0%, 100% { filter: brightness(1) hue-rotate(0deg); }
          25% { filter: brightness(1.2) hue-rotate(90deg); }
          50% { filter: brightness(1.4) hue-rotate(180deg); }
          75% { filter: brightness(1.2) hue-rotate(270deg); }
        }
        .neon-bg {
          background: radial-gradient(circle at 20% 80%, #ff00ff33 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, #00ffff33 0%, transparent 50%),
                      radial-gradient(circle at 40% 40%, #ff008033 0%, transparent 50%),
                      linear-gradient(135deg, #0a0a0a 0%, #1a0a1a 25%, #0a0a2a 50%, #2a0a2a 75%, #0f0f0f 100%);
        }
        .neon-glass {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 0, 255, 0.3);
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .neon-text {
          color: #00ffff;
          text-shadow: 0 0 1px #00ffff, 0 0 0px #00ffff, 0 0 15px #00ffff;
        }
        .neon-button {
          background: linear-gradient(45deg, rgba(255, 0, 255, 0.2), rgba(0, 255, 255, 0.2));
          border: 1px solid rgba(255, 0, 255, 0.5);
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
          transition: all 0.3s ease;
        }
        .neon-button:hover {
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3);
          border-color: rgba(0, 255, 255, 0.8);
        }
        .grid-pattern {
          background-image: 
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
      
      <div className="min-h-screen  relative overflow-hidden neon-bg grid-pattern">
        
        {/* Animated Neon Particles Background */}
        <div className="fixed inset-0 bg-slate-900 pointer-events-none">
          {neonParticles.map((particle) => (
            <NeonParticle
              key={particle.id}
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                color: particle.color,
                animationDelay: `${particle.animationDelay}s`,
                opacity: particle.opacity
              }}
            />
          ))}
        </div>

        {showFullScreen && (
          <div className="fixed inset-0 neon-bg z-50">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setShowFullScreen(false)} 
                className="neon-glass hover:bg-black/40 text-cyan-300 px-4 py-2 rounded-lg flex items-center space-x-2 neon-button transition-all duration-300">
                <EyeOff className="w-4 h-4" />
                <span>Close Preview</span>
              </button>
            </div>
            <iframe srcDoc={generatePreviewHTML()} title="Full Preview" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-modals" />
          </div>
        )}
        
        <div className="max-w-6xl mx-auto relative z-10 p-4">
          <div className="neon-glass rounded-t-xl p-6 border-b border-pink-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-pink-500 to-cyan-500 p-3 rounded-lg" style={{
                  boxShadow: '0 0 30px rgba(255, 0, 255, 0.6), 0 0 60px rgba(0, 255, 255, 0.4)',
                  animation: 'neonGlow 3s infinite'
                }}>
                  <Code className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold neon-text">⚡O-CD Wallah</h1>
                  <p className="text-pink-400">🌃 On‑Demand Code Design - Wallah</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={() => setShowFullScreen(true)} 
                  disabled={!generatedFiles['index.html'] && !Object.keys(generatedFiles).length} 
                  className="neon-button text-cyan-300 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300 disabled:opacity-50">
                  <Monitor className="w-4 h-4" />
                  <span>🌃 Full View</span>
                </button>

                <button onClick={() => setShowSettings(prev => !prev)} 
                  className="neon-button text-pink-300 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300">
                  <Settings className="w-4 h-4" />
                  <span>⚙️ Config</span>
                </button>

                <button onClick={clearAll} 
                  className="neon-button text-red-400 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300 hover:shadow-red-500/50">
                  <Trash2 className="w-4 h-4" />
                  <span>🗑️ Purge</span>
                </button>

                <button onClick={downloadFiles} 
                  disabled={!Object.keys(generatedFiles).length} 
                  className="neon-button text-green-400 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300 disabled:opacity-50">
                  <Download className="w-4 h-4" />
                  <span>💾 Export</span>
                </button>
              </div>
            </div>

            {showSettings && (
              <div className="mt-4 p-4 neon-glass rounded-lg border border-cyan-500/30">
                <h3 className="text-cyan-300 font-semibold mb-3">🔧 Neural Network Config</h3>
                <div className="flex gap-3 items-center">
                  <label className="text-pink-300">AI Model:</label>
                  <input value={model} onChange={e => setModel(e.target.value)} 
                    className="px-2 py-1 rounded neon-glass text-cyan-300 placeholder-pink-400/50 border border-pink-500/30 focus:border-cyan-500/50 focus:outline-none" />
                  <div className="text-xs text-purple-400">Default: gemini-2.5-flash</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex neon-glass rounded-b-xl overflow-hidden" style={{ height: '70vh' }}>
            {/* Chat / Controls */}
            <div className={`${showPreview ? 'w-1/2' : 'flex-1'} flex flex-col border-r border-pink-500/20`}>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-cyan-300 mt-12">
                    <div className="text-4xl mb-4 animate-pulse">⚡</div>
                    <Code className="w-16 h-16 mx-auto mb-4 opacity-70 text-pink-400" style={{
                      filter: 'drop-shadow(0 0 10px #ff00ff)'
                    }} />
                    <h3 className="text-xl font-semibold mb-2 neon-text">WELCOME TO THE NEON NIGHTS</h3>
                    <p className="mb-6 text-pink-300">Enter the cyberpunk realm. Describe your digital vision and watch the neon magic unfold! 🌃</p>
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-sm font-medium text-purple-300 mb-2">🚀 Initialize with these commands:</p>
                      {defaultExamplePrompts.map((p,i) => (
                        <button key={i} onClick={() => setInput(p)} 
                          className="w-full text-left p-3 neon-glass hover:bg-black/40 rounded-lg text-sm transition-all duration-300 text-cyan-200 border border-pink-500/20 hover:border-cyan-500/50">
                          "⚡ {p}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      m.type === 'user' ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border border-pink-400' : 
                      m.type === 'error' ? 'neon-glass text-red-300 border border-red-500/50' : 
                      m.type === 'success' ? 'neon-glass text-green-300 border border-green-500/50' : 
                      m.type === 'warning' ? 'neon-glass text-yellow-300 border border-yellow-500/50' : 
                      'neon-glass text-cyan-300 border border-cyan-500/30'
                    }`} style={{
                      boxShadow: m.type === 'user' ? '0 0 20px rgba(255, 0, 255, 0.3)' : '0 0 15px rgba(0, 255, 255, 0.2)'
                    }}>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      <p className="text-xs opacity-70 mt-1">{m.timestamp}</p>
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="neon-glass text-cyan-300 px-4 py-2 rounded-lg border border-pink-500/30">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-500" style={{
                          boxShadow: '0 0 10px #ff00ff'
                        }}></div>
                        <span className="text-sm">⚡ Neural networks are compiling your vision...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-pink-500/20 p-6">
                <div className="flex space-x-3">
                  <input value={input} onChange={e => setInput(e.target.value)} 
                    placeholder="⚡ Enter your cyberpunk vision..." disabled={isProcessing} 
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                    className="flex-1 px-4 py-3 neon-glass border border-pink-500/30 rounded-lg text-cyan-300 placeholder-purple-400/70 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-500/50 disabled:opacity-50" />
                  <button onClick={handleSubmit}
                    className="bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-300 font-semibold" 
                    disabled={isProcessing || !input.trim()}
                    style={{
                      boxShadow: '0 0 25px rgba(255, 0, 255, 0.4), 0 0 50px rgba(0, 255, 255, 0.2)',
                      textShadow: '0 0 10px rgba(255, 255, 255, 0.8)'
                    }}>
                    <Play className="w-4 h-4" />
                    <span>🚀 EXECUTE</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="w-1/2 border-r border-pink-500/20 bg-black">
                <div className="p-4 border-b border-cyan-500/30 neon-glass">
                  <h3 className="neon-text font-semibold flex items-center">
                    <Monitor className="w-4 h-4 mr-2" />
                    🌃 Neon Preview
                  </h3>
                </div>
                <div className="h-full overflow-hidden">
                  {Object.keys(generatedFiles).length ? (
                    <iframe srcDoc={generatePreviewHTML()} title="Preview" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-modals" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-cyan-400">
                      <div className="text-center">
                        <div className="text-4xl mb-4 animate-pulse">⚡</div>
                        <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" style={{
                          filter: 'drop-shadow(0 0 15px #00ffff)'
                        }} />
                        <p className="neon-text">No preview in the matrix</p>
                        <p className="text-sm text-pink-400">Execute a command first ⚡</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File Explorer */}
            <div className="w-80 neon-glass border-l border-pink-500/20">
              <div className="p-4 border-b border-cyan-500/20">
                <h3 className="neon-text font-semibold flex items-center justify-between">
                  <div className="flex items-center">
                    <Folder className="w-4 h-4 mr-2" />
                    💾 Digital Assets ({Object.keys(generatedFiles).length})
                  </div>
                </h3>
              </div>

              <div className="p-4">
                {!Object.keys(generatedFiles).length ? (
                  <p className="text-pink-400/70 text-sm">⚡ No files in the matrix...</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(generatedFiles).map(([fn, content]) => (
                      <div key={fn} 
                        onClick={() => setSelectedFile(selectedFile === fn ? null : fn)} 
                        className={`neon-glass rounded-lg p-3 hover:bg-black/40 transition-all duration-300 cursor-pointer border
                          ${selectedFile === fn ? 'border-cyan-500/80 shadow-cyan-500/30' : 'border-pink-500/20 hover:border-cyan-500/50'}`}
                        style={{
                          boxShadow: selectedFile === fn ? '0 0 20px rgba(0, 255, 255, 0.3)' : '0 0 10px rgba(255, 0, 255, 0.1)'
                        }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-cyan-400" />
                            <span className="text-cyan-300 text-sm font-medium">📁 {fn}</span>
                          </div>
                          <span className="text-pink-400/50 text-xs">{(content.length/1024).toFixed(1)}KB</span>
                        </div>
                        {selectedFile === fn && (
                          <div className="mt-3 p-3 bg-black/60 rounded text-xs text-green-300 font-mono max-h-40 overflow-y-auto border border-green-500/30" style={{
                            boxShadow: 'inset 0 0 10px rgba(0, 255, 0, 0.1)'
                          }}>
                            <pre className="whitespace-pre-wrap break-words">{content.length > 500 ? content.substring(0,500) + '...' : content}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;