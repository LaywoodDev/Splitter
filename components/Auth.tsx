import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Button } from './UI';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
            email: cleanEmail, 
            password 
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: name || cleanEmail.split('@')[0],
              avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name || cleanEmail}`
            }
          }
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "Неверный логин или пароль" : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background text-white">
      <div className="w-full max-w-sm">
        
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tighter mb-2">Split.</h1>
          <p className="text-zinc-500">
            {isLogin ? 'Войдите в систему.' : 'Контролируйте расходы.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-8">
          <div className="space-y-4">
            {!isLogin && (
              <div className="group">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full bg-transparent border-b border-zinc-800 py-3 text-lg text-white placeholder-zinc-700 focus:outline-none focus:border-white transition-colors rounded-none"
                  placeholder="Ваше Имя"
                />
              </div>
            )}

            <div className="group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full bg-transparent border-b border-zinc-800 py-3 text-lg text-white placeholder-zinc-700 focus:outline-none focus:border-white transition-colors rounded-none"
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full bg-transparent border-b border-zinc-800 py-3 text-lg text-white placeholder-zinc-700 focus:outline-none focus:border-white transition-colors rounded-none"
                placeholder="Пароль"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 text-red-500 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="pt-4">
            <Button type="submit" fullWidth size="lg" disabled={loading} className="group relative overflow-hidden">
              {loading ? (
                 <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                 <span className="flex items-center justify-center">
                    {isLogin ? 'Войти' : 'Продолжить'} <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                 </span>
              )}
            </Button>
            
            <div className="mt-6 text-center">
                <button 
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="text-sm text-zinc-500 hover:text-white transition-colors"
                >
                {isLogin ? 'Нет аккаунта? Регистрация' : 'Есть аккаунт? Вход'}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};