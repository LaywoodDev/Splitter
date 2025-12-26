import React, { useState, useRef } from 'react';
import { LogOut, Check, ChevronRight, Copy, ArrowRight, Settings, Camera, Loader2, ArrowLeft, Users, Trash2 } from 'lucide-react';
import { Friend, Profile } from '../types';
import { supabase } from '../supabaseClient';
import { Button, Avatar } from './UI';
import { AnimatePresence, motion } from 'framer-motion';

interface ProfileViewProps {
  currentUser: Profile;
  friends?: Friend[];
  onLogout: () => void;
  onUpdateProfile?: (updated: Profile) => void;
  onRemoveFriend?: (id: string) => void;
}

// Helper: Resize and compress image
const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

type ViewState = 'main' | 'friends' | 'settings';

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, friends = [], onLogout, onUpdateProfile, onRemoveFriend }) => {
  const [view, setView] = useState<ViewState>('main');
  const [copied, setCopied] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for sub-views
  const [email, setEmail] = useState(''); // For adding friend
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: '' });
  const [newName, setNewName] = useState(currentUser.name);

  const handleCopy = () => {
      navigator.clipboard.writeText(currentUser.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      setIsUpdatingAvatar(true);
      try {
          const base64Image = await processImage(file);
          const { error } = await supabase.from('profiles').update({ avatar: base64Image }).eq('id', currentUser.id);
          if (error) throw error;
          if (onUpdateProfile) onUpdateProfile({ ...currentUser, avatar: base64Image });
      } catch (err: any) {
          console.error(err);
      } finally {
          setIsUpdatingAvatar(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleSendRequest = async () => {
    if (!email) return;
    setStatus({ type: null, msg: '' });
    const targetEmail = email.trim().toLowerCase();
    try {
        const { data: users, error: findError } = await supabase.from('profiles').select('id').eq('email', targetEmail).single();
        if (findError || !users) throw new Error('Пользователь не найден');
        if (users.id === currentUser.id) throw new Error('Это ваш email');
        
        // Check if already friends
        const existingFriend = friends.find(f => f.id === users.id);
        if (existingFriend) throw new Error('Уже в друзьях');

        const { error: sendError } = await supabase.from('friend_requests').insert({ sender_id: currentUser.id, receiver_id: users.id, status: 'pending' });
        if (sendError) throw sendError;
        setStatus({ type: 'success', msg: `Запрос отправлен` });
        setEmail('');
        setTimeout(() => setStatus({ type: null, msg: '' }), 3000);
    } catch (e: any) {
        setStatus({ type: 'error', msg: e.message || 'Ошибка' });
    }
  };

  const handleUpdateName = async () => {
      if (!newName || newName === currentUser.name) return;
      try {
          const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', currentUser.id);
          if (error) throw error;
          if (onUpdateProfile) onUpdateProfile({ ...currentUser, name: newName });
          setView('main');
      } catch (e) { console.error(e); }
  };

  const renderMain = () => (
    <div className="space-y-12">
        <div className="flex flex-col items-center text-center space-y-6">
            <div 
                className="relative group cursor-pointer" 
                onClick={() => !isUpdatingAvatar && fileInputRef.current?.click()}
            >
                <Avatar 
                    name={currentUser.name} 
                    src={currentUser.avatar} 
                    size="2xl" 
                    className="ring-1 ring-white/10 shadow-2xl transition-transform group-hover:scale-105 rounded-full" 
                />
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm border border-white/20">
                    {isUpdatingAvatar ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                </div>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-4xl font-medium tracking-tight text-white">{currentUser.name}</h2>
                <button 
                    onClick={handleCopy}
                    className="flex items-center justify-center space-x-2 text-zinc-500 hover:text-zinc-300 transition-colors mx-auto text-sm"
                >
                    <span>{currentUser.email}</span>
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-50" />}
                </button>
            </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        <div className="space-y-2 max-w-sm mx-auto w-full">
            <button onClick={() => setView('friends')} className="w-full flex items-center justify-between p-4 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-all group">
                <div className="flex items-center space-x-4">
                    <Users className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
                    <span className="font-medium">Мои друзья ({friends.filter(f => !f.isMe).length})</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-700" />
            </button>

            <button onClick={() => setView('settings')} className="w-full flex items-center justify-between p-4 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-all group">
                <div className="flex items-center space-x-4">
                    <Settings className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
                    <span className="font-medium">Настройки</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-700" />
            </button>
            
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-between p-4 rounded-xl text-red-500/80 hover:text-red-500 hover:bg-red-500/5 transition-all group"
            >
                <div className="flex items-center space-x-4">
                    <LogOut className="w-5 h-5 transition-colors" />
                    <span className="font-medium">Выйти</span>
                </div>
            </button>
        </div>
    </div>
  );

  const renderFriends = () => (
      <div className="space-y-8 max-w-sm mx-auto w-full">
          <div className="flex items-center space-x-4">
              <button onClick={() => setView('main')} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold">Друзья</h2>
          </div>

          <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                     <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Добавить нового</span>
                     {status.msg && (
                        <span className={`text-[10px] font-bold ${status.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                            {status.msg}
                        </span>
                     )}
                </div>
                <div className="relative group">
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full bg-zinc-900/30 border border-zinc-800 focus:border-zinc-600 rounded-xl py-4 px-4 text-white placeholder-zinc-700 outline-none transition-all focus:bg-zinc-900"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                    />
                    <button 
                        onClick={handleSendRequest}
                        disabled={!email}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${email ? 'text-white hover:bg-zinc-800' : 'text-zinc-700'}`}
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="space-y-1 pt-4">
                <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest px-1 mb-2">Список ({friends.filter(f => !f.isMe).length})</h3>
                {friends.filter(f => !f.isMe).length === 0 ? (
                    <p className="text-zinc-500 text-sm p-4 text-center border border-zinc-800/50 rounded-xl border-dashed">Пока никого нет</p>
                ) : (
                    <div className="space-y-2">
                        {friends.filter(f => !f.isMe).map(friend => (
                            <div key={friend.id} className="flex items-center justify-between p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                                <div className="flex items-center space-x-3">
                                    <Avatar name={friend.name} src={friend.avatar} size="md" />
                                    <div>
                                        <p className="font-medium text-sm text-white">{friend.name}</p>
                                        <p className="text-xs text-zinc-500">{friend.email}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onRemoveFriend && onRemoveFriend(friend.id)}
                                    className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
      </div>
  );

  const renderSettings = () => (
    <div className="space-y-8 max-w-sm mx-auto w-full">
        <div className="flex items-center space-x-4">
            <button onClick={() => setView('main')} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold">Настройки</h2>
        </div>

        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Ваше имя</label>
                <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-zinc-900/30 border border-zinc-800 focus:border-white rounded-xl py-4 px-4 text-white outline-none transition-all"
                />
            </div>
            <Button fullWidth onClick={handleUpdateName} disabled={newName === currentUser.name}>
                Сохранить
            </Button>
        </div>
    </div>
  );

  return (
    <div className="p-6 pt-20 animate-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
        {/* Hidden File Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*" 
            className="hidden" 
        />

        <AnimatePresence mode="wait">
            <motion.div
                key={view}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
            >
                {view === 'main' && renderMain()}
                {view === 'friends' && renderFriends()}
                {view === 'settings' && renderSettings()}
            </motion.div>
        </AnimatePresence>
    </div>
  );
};

export const ProfileModal = ProfileView;