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
  const recognitionRef = useRef(null);
  
  const { RiveComponent, rive } = useRive({
    src: '/BIGEYES.riv',
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
      };
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
      alert('您的浏览器不支持语音识别，请使用 Chrome 浏览器');
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
      
      recognitionRef.current.start();
      setIsListening(true);
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
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '8px',
          zIndex: 1000,
        }}>
          {MOOD_STATES.map((state) => (
            <button
              key={state.value}
              onClick={() => handleMoodChange(state.value)}
              style={{
                padding: '5px 10px',
                backgroundColor: currentMood === state.value ? state.color : 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              {state.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Debug 开关 */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          width: '32px',
          height: '32px',
          minWidth: '32px',
          maxWidth: '32px',
          padding: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: panelOpen ? '18px' : '10px',
          lineHeight: 1,
        }}
      >
        {panelOpen ? '×' : '⚙'}
      </button>
    </>
  );
}

export default App
