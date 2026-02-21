import { useState } from 'react'
import { useNotification } from '../context/NotificationContext'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../utils/api'
import logoImage from '../images/Img111.png'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { addNotification } = useNotification()
  const { theme, toggleTheme } = useTheme()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      addNotification('الرجاء إدخال اسم المستخدم وكلمة المرور', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await response.json()
      if (data.success) {
        const loginTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        addNotification(`تم تسجيل الدخول - ${loginTime}`, 'success', true, 'login-notification')
        onLogin(data.user)
      } else {
        addNotification(data.message, 'error')
      }
    } catch (error) {
      addNotification('خطأ في الاتصال بالخادم', 'error')
    }
    setLoading(false)
  }

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-gray-900' : 'bg-brown/10'}`}>
      <button
        onClick={toggleTheme}
        className={`fixed top-6 left-6 p-3 rounded-full shadow-lg z-50 transition-all ${
          theme === 'dark' ? 'bg-gray-800 text-camel hover:bg-gray-700' : 'bg-white text-brown hover:bg-gray-100'
        }`}
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          {theme === 'dark' ? (
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          ) : (
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          )}
        </svg>
      </button>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className={`flex-1 flex items-center justify-center p-8 lg:p-12 ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-brown/5'
        }`}>
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className={`inline-flex p-4 rounded-full mb-4 ${
                theme === 'dark' ? 'bg-camel/10' : 'bg-brown/20'
              }`}>
                <svg className={`w-16 h-16 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                تسجيل الدخول
              </h1>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
               مرحباً بك
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  اسم المستخدم
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full pr-10 pl-4 py-3 rounded-lg border-2 transition-all ${
                      theme === 'dark' 
                        ? 'bg-gray-800 border-gray-700 text-white focus:border-camel' 
                        : 'bg-white border-brown/40 text-gray-900 focus:border-brown'
                    } focus:outline-none`}
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  كلمة المرور
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pr-10 pl-4 py-3 rounded-lg border-2 transition-all ${
                      theme === 'dark' 
                        ? 'bg-gray-800 border-gray-700 text-white focus:border-camel' 
                        : 'bg-white border-brown/40 text-gray-900 focus:border-brown'
                    } focus:outline-none`}
                    placeholder="أدخل كلمة المرور"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-lg font-bold transition-all shadow-lg transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-camel to-amber-500 text-black hover:from-amber-500 hover:to-camel'
                    : 'bg-brown text-white hover:brightness-110'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    جاري الدخول...
                  </span>
                ) : (
                  'تسجيل الدخول'
                )}
              </button>
            </form>

            <div className={`mt-8 p-4 rounded-lg ${
              theme === 'dark' ? 'bg-amber-900/20 border border-amber-800/30' : 'bg-brown/10 border border-brown/30'
            }`}>
              <p className={`text-center text-sm leading-relaxed ${
                theme === 'dark' ? 'text-amber-200/80' : 'text-brown'
              }`} style={{ fontFamily: 'Arial, sans-serif' }}>
                "عَالِيَهُمْ ثِيَابُ سُندُسٍ خُضْرٌ وَإِسْتَبْرَقٌ"
              </p>
              <p className={`text-center text-xs mt-2 ${
                theme === 'dark' ? 'text-amber-300/60' : 'text-brown'
              }`}>
                سورة الإنسان - آية 21
              </p>
            </div>

            <div className="mt-6 text-center">
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                © 2025 جميع الحقوق محفوظة
              </p>
              <p className={`text-sm font-bold mt-1 ${
                theme === 'dark' ? 'text-camel' : 'text-brown'
              }`}>
                المهندس عبدالله أحمد نار
              </p>
            </div>
          </div>
        </div>

        <div className={`flex-1 flex items-center justify-center p-8 lg:p-12 ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' 
            : 'bg-brown'
        }`}>
          <div className="text-center">
            <div className="mb-8 inline-block relative">
              <div className={`absolute inset-0 blur-3xl rounded-full ${
                theme === 'dark' ? 'bg-camel/30' : 'bg-white/20'
              }`} />
              <img 
                src={logoImage} 
                alt="M.G Logo" 
                className={`w-64 h-64 object-contain drop-shadow-2xl transition-all duration-500 relative z-10 ${
                  theme === 'dark' 
                    ? 'brightness-150 contrast-125 saturate-125 drop-shadow-[0_0_50px_rgba(218,165,32,0.6)]' 
                    : 'brightness-125 contrast-105 saturate-110 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]'
                }`}
                style={theme === 'dark' ? { filter: 'brightness(1.5) contrast(1.25) saturate(1.25) drop-shadow(0 0 50px rgba(218,165,32,0.6)) drop-shadow(0 0 20px rgba(255,255,255,0.3))' } : {}}
              />
            </div>

            <div className="space-y-4">
              <h2 className={`text-5xl font-black tracking-wider ${
                theme === 'dark' ? 'text-camel' : 'text-white'
              }`} style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                M.G
              </h2>
              <div className={`h-1 w-32 mx-auto rounded-full ${
                theme === 'dark' ? 'bg-camel' : 'bg-white'
              }`} />
              <h3 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-white'
              }`}>
                FASHION FABRIC
              </h3>
              <div className={`mt-8 px-6 py-4 rounded-lg ${
                theme === 'dark' ? 'bg-camel/10 border border-camel/30' : 'bg-white/20 border border-white/40'
              }`}>
                <p className={`text-center text-lg leading-relaxed italic ${
                  theme === 'dark' ? 'text-camel' : 'text-white'
                }`}>
                  "وَيَلْبَسُونَ ثِيَابًا خُضْرًا مِن سُندُسٍ وَإِسْتَبْرَقٍ"
                </p>
                <p className={`text-center text-sm mt-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-white/80'
                }`}>
                  سورة الكهف - آية 31
                </p>
              </div>
              <div className="flex items-center justify-center gap-6 mt-12">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-camel/20' : 'bg-white/20'
                }`}>
                  {/* بكرة خيط (threads) */}
                  <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="6" y="4" width="12" height="16" rx="2" strokeWidth="2" />
                    <path d="M8 7h8M8 10h8M8 13h8M8 16h8" strokeWidth="2" />
                  </svg>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-camel/20' : 'bg-white/20'
                }`}>
                  {/* لفة قماش (fabric roll) */}
                  <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="7" cy="12" r="3" strokeWidth="2" />
                    <rect x="10" y="9" width="9" height="6" rx="2" strokeWidth="2" />
                    <path d="M7 9a3 3 0 000 6" strokeWidth="2" />
                  </svg>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-camel/20' : 'bg-white/20'
                }`}>
                  {/* شارة جودة (quality badge) */}
                  <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2l2.5 4.5L20 8l-3.5 3 1 4.5L12 14l-5.5 1.5 1-4.5L4 8l5.5-1.5L12 2z" strokeWidth="2" />
                    <path d="M9.5 11.5l2 2 3-3" strokeWidth="2" />
                  </svg>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-camel/20' : 'bg-white/20'
                }`}>
                  {/* إبرة وخيط (needle) */}
                  <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 3l-8 18" strokeWidth="2" />
                    <path d="M14 5c2 0 3.5 1.5 3.5 3.5S16 12 14 12" strokeWidth="2" />
                    <circle cx="18" cy="3" r="1" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
