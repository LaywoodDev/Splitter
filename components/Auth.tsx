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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-white">
      
      <div className="w-full max-w-sm space-y-10">
        
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold tracking-tighter">Split.</h1>
          <p className="text-zinc-500 font-medium">
            {isLogin ? 'С возвращением.' : 'Создать аккаунт.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            {!isLogin && (
              <div className="group animate-in slide-in-from-top-2 fade-in">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-5 text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-0 transition-all font-medium"
                  placeholder="Ваше Имя"
                />
              </div>
            )}

            <div className="group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-5 text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-0 transition-all font-medium"
                placeholder="Email"
                required
              />
            </div>

            <div className="group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-5 text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-0 transition-all font-medium"
                placeholder="Пароль"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium rounded-xl text-center">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" fullWidth size="lg" disabled={loading} className="h-14 text-base rounded-2xl">
              {loading ? (
                 <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                 <span className="flex items-center justify-center">
                    {isLogin ? 'Войти' : 'Продолжить'} <ArrowRight className="w-5 h-5 ml-2" />
                 </span>
              )}
            </Button>
            
            <div className="mt-8 text-center">
                <button 
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="text-sm font-medium text-zinc-500 hover:text-white transition-colors"
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