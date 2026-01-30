import { useEffect, useCallback, useState, useRef } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import './App.css'

const DEEPSEEK_API_KEY = 'sk-3930d20fec8d4d6387a2842a2fd702a9';

const MOOD_STATES = [
  { value: 0, label: 'Basic', color: '#4a5568' },
  { value: 1, label: 'Upset', color: '#e53e3e' },
  { value: 2, label: 'Tired', color: '#805ad5' },
  { value: 3, label: 'TiredHaqie', color: '#d69e2e' },
  { value: 4, label: 'Confusion', color: '#3182ce' },
  { value: 5, label: 'Thinking', color: '#38a169' },
];

const SYSTEM_PROMPT = `你是一个可爱的表情角色。用户会和你对话，你需要：
1. 用简短友好的方式回复（不超过30字）
2. 根据对话内容判断应该展示什么表情
3. 不要在回复中使用emoji，你的表情会通过动画展示

表情对应的mood值：
- 0: Basic (普通/开心/友好/打招呼)
- 1: Upset (生气/不满/难过/委屈)
- 2: Tired (疲惫/无聊/发呆/累了/没劲)
- 3: TiredHaqie (困/想睡/打哈欠/睡意/困倒了)
- 4: Confusion (困惑/疑问/不解/什么/为什么)
- 5: Thinking (思考/沉思/认真/让我想想)

请用JSON格式回复：{"reply": "你的回复", "mood": 数字}`;

function App() {
  const [currentMood, setCurrentMood] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  
  const { RiveComponent, rive } = useRive({
    src: `${import.meta.env.BASE_URL}BIGEYES.riv`,
    stateMachines: 'State Machine 1',
    autoplay: true,
  });

  const moodInput = useStateMachineInput(rive, 'State Machine 1', 'Mood');
  const moodInputRef = useRef(null);
  
  // 保持 moodInput 最新引用
  useEffect(() => {
    moodInputRef.current = moodInput;
  }, [moodInput]);

  // 初始化语音识别
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
          setSpeechSupported(false);
        } else if (event.error === 'no-speech') {
          alert('没有检测到语音，请重试');
        } else if (event.error === 'network') {
          alert('网络错误，语音识别需要网络连接');
        }
      };
    } else {
      setSpeechSupported(false);
      console.warn('浏览器不支持语音识别');
    }
  }, []);

  // 语音合成（女声）
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      
      // 选择女声
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.lang.includes('zh') && (v.name.includes('female') || v.name.includes('Xiaoxiao') || v.name.includes('Huihui') || v.name.includes('女') || v.name.includes('Yating'))
      ) || voices.find(v => v.lang.includes('zh'));
      
      if (femaleVoice) utterance.voice = femaleVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  // 预加载声音列表
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  // 调用 DeepSeek API
  const callDeepSeek = async (userMessage) => {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // 解析 JSON 回复
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { reply: content, mood: 0 };
    } catch (error) {
      console.error('DeepSeek API error:', error);
      return { reply: '抱歉，我出了点问题...', mood: 4 };
    }
  };

  // 处理用户输入
  const handleUserInput = async (text) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    handleMoodChange(5); // 思考中
    
    const result = await callDeepSeek(text);
    
    setAiReply(result.reply);
    handleMoodChange(result.mood);
    speak(result.reply);
    
    setIsProcessing(false);
  };

  // 开始/停止语音识别
  const toggleListening = () => {
    if (!recognitionRef.current) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      if (isIOS) {
        alert('抱歉，iOS Safari 不支持语音识别\n\n建议：\n1. 使用 Android Chrome 浏览器\n2. 或访问 GitHub Pages 部署版本（HTTPS）');
      } else if (isMobile) {
        alert('移动端语音识别需要 HTTPS 环境\n\n请访问 GitHub Pages 部署版本');
      } else {
        alert('您的浏览器不支持语音识别，请使用 Chrome 浏览器');
      }
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setAiReply('');
      
      // 重新绑定 onresult，确保获取最新的 ref
      recognitionRef.current.onresult = async (event) => {
        const result = event.results[event.results.length - 1];
        const text = result[0].transcript;
        setTranscript(text);
        
        if (result.isFinal) {
          setIsProcessing(true);
          
          // 思考中
          setCurrentMood(5);
          if (moodInputRef.current) moodInputRef.current.value = 5;
          
          const apiResult = await callDeepSeek(text);
          
          setAiReply(apiResult.reply);
          setCurrentMood(apiResult.mood);
          if (moodInputRef.current) moodInputRef.current.value = apiResult.mood;
          speak(apiResult.reply);
          
          setIsProcessing(false);
        }
      };
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('启动语音识别失败:', error);
        alert('启动语音识别失败，请刷新页面重试');
      }
    }
  };

  const onMouseMove = useCallback((e) => {
    if (!rive) return;
    
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    rive.pointerMove(x, y);
  }, [rive]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [onMouseMove]);

  const handleMoodChange = (value) => {
    setCurrentMood(value);
    if (moodInputRef.current) {
      moodInputRef.current.value = value;
    }
  };

  return (
    <>
      <RiveComponent style={{ 
        width: '100vw', 
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#f6d4e1'
      }} />
      
      {/* 语音按钮 */}
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: isListening ? '#ff6b6b' : isProcessing ? '#a855f7' : '#fff',
          border: 'none',
          cursor: isProcessing ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isListening 
            ? '0 0 0 4px rgba(255,107,107,0.3), 0 4px 20px rgba(255,107,107,0.4)' 
            : '0 4px 20px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease',
          zIndex: 1000,
        }}
      >
        {isProcessing ? (
          // 加载动画
          <div style={{
            width: '20px',
            height: '20px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
        ) : isListening ? (
          // 停止图标
          <div style={{
            width: '18px',
            height: '18px',
            backgroundColor: '#fff',
            borderRadius: '3px',
          }} />
        ) : (
          // 麦克风图标
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#333" />
            <path d="M5 10v1a7 7 0 0014 0v-1" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="22" stroke="#333" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      
      {/* 语音识别提示 */}
      {!speechSupported && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          borderRadius: '20px',
          fontSize: '12px',
          zIndex: 999,
          whiteSpace: 'nowrap',
        }}>
          {/iPhone|iPad|iPod/i.test(navigator.userAgent) 
            ? 'iOS 不支持语音识别' 
            : '需要 HTTPS 环境'}
        </div>
      )}
      
      {/* CSS 动画 */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* 对话气泡 */}
      {(transcript || aiReply) && (
        <div style={{
          position: 'fixed',
          bottom: 110,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          zIndex: 1000,
        }}>
          {transcript && (
            <div style={{
              padding: '12px 18px',
              backgroundColor: '#fff',
              borderRadius: '18px 18px 4px 18px',
              fontSize: '14px',
              color: '#333',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              maxWidth: '200px',
            }}>
              {transcript}
            </div>
          )}
          {aiReply && (
            <div style={{
              padding: '12px 18px',
              backgroundColor: '#fff',
              borderRadius: '18px 18px 18px 4px',
              fontSize: '14px',
              color: '#333',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              maxWidth: '200px',
            }}>
              {aiReply}
            </div>
          )}
        </div>
      )}

      {/* Debug 面板 */}
      {panelOpen && (
        <div style={{
          position: 'fixed',
          top: 10,
          left: 10,
          right: 10,
          padding: '8px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: '12px',
          zIndex: 1000,
          maxWidth: '400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
            gap: '6px',
            flex: 1,
          }}>
            {MOOD_STATES.map((state) => (
              <button
                key={state.value}
                onClick={() => handleMoodChange(state.value)}
                style={{
                  padding: '8px 4px',
                  backgroundColor: currentMood === state.value ? state.color : 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: currentMood === state.value ? '2px solid rgba(255,255,255,0.5)' : 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: currentMood === state.value ? '600' : '400',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                {state.label}
              </button>
            ))}
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={() => setPanelOpen(false)}
            style={{
              width: '32px',
              height: '32px',
              minWidth: '32px',
              padding: 0,
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '20px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Debug 开关（面板关闭时显示） */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            width: '40px',
            height: '40px',
            minWidth: '40px',
            maxWidth: '40px',
            padding: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '16px',
            lineHeight: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          ⚙
        </button>
      )}
    </>
  );
}

export default App
