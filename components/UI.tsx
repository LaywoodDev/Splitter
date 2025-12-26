import React from 'react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';

// --- Card Component ---
interface CardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <motion.div 
      className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// --- Bottom Sheet Component (New) ---
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, children, title }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
            className="fixed bottom-0 left-0 right-0 bg-[#0F0F0F] rounded-t-[32px] z-50 border-t border-zinc-800 max-h-[90dvh] flex flex-col shadow-2xl"
          >
            {/* Handle */}
            <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
            </div>
            
            {title && (
                <div className="px-6 pb-4 pt-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                </div>
            )}

            <div className="overflow-y-auto overflow-x-hidden p-6 pt-0 pb-10">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- Button Component ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', size = 'md', fullWidth = false, ...props }) => {
  const baseStyle = "font-medium flex items-center justify-center transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 active:scale-[0.98] rounded-xl",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700 active:bg-zinc-800 rounded-xl",
    ghost: "bg-transparent text-zinc-400 hover:text-white rounded-xl",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl",
    icon: "bg-transparent text-white hover:bg-white/10 rounded-full"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-4 text-base",
    icon: "p-2"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- Avatar Component ---
interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  active?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className = '', active = false }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-10 h-10 text-xs",
    lg: "w-14 h-14 text-sm",
    xl: "w-20 h-20 text-base",
    '2xl': "w-32 h-32 text-3xl"
  };

  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  return (
    <div className={`relative ${className}`}>
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold border transition-all ${active ? 'border-white bg-white text-black' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>
        {src ? (
            <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
            <span>{initials}</span>
        )}
        </div>
        {active && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-black"></div>
        )}
    </div>
  );
};

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white">
    {children}
  </span>
);