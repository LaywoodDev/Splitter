import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, Users, User, Sparkles, ArrowUp, X } from 'lucide-react';
import { Friend, Expense } from '../types';
import { Button, Avatar, BottomSheet } from './UI';
import { GoogleGenAI, Type } from "@google/genai";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friend[];
  onAdd: (expense: Omit<Expense, 'id' | 'date'>) => void;
  currentUser: Friend;
  isSubmitting?: boolean;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, friends, onAdd, currentUser, isSubmitting }) => {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  // Payer State
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState<string>(currentUser.id);
  const [multiPayers, setMultiPayers] = useState<Record<string, string>>({}); // {id: amountString}

  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [expandSplit, setExpandSplit] = useState(false);

  // AI State
  const [isMagicMode, setIsMagicMode] = useState(false);
  const [magicText, setMagicText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setAmount('');
        setDescription('');
        setSinglePayerId(currentUser.id);
        setIsMultiPayer(false);
        setMultiPayers({});
        setSplitBetween(friends.map(f => f.id));
        setExpandSplit(false);
        setIsMagicMode(false);
        setMagicText('');
    }
  }, [isOpen, friends, currentUser.id]);

  // Calculate total for multi-payer mode
  useEffect(() => {
      if (isMultiPayer) {
          const total = Object.values(multiPayers).reduce<number>((acc, val) => acc + (parseFloat(val as string) || 0), 0);
          setAmount(total > 0 ? total.toString() : '');
      }
  }, [multiPayers, isMultiPayer]);

  const handleSubmit = () => {
    const finalAmount = parseFloat(amount);
    if (!finalAmount || !description || splitBetween.length === 0) return;

    let paidByPayload: Record<string, number> = {};

    if (isMultiPayer) {
        // Convert strings to numbers
        Object.entries(multiPayers).forEach(([id, amt]) => {
            const val = parseFloat(amt as string);
            if (val > 0) paidByPayload[id] = val;
        });
        // Check if sums match (basic validation)
        const checkSum = Object.values(paidByPayload).reduce((a, b) => a + b, 0);
        if (Math.abs(checkSum - finalAmount) > 0.01) {
             // In a real app we would show an error, here we rely on the useEffect above keeping them synced
        }
    } else {
        paidByPayload[singlePayerId] = finalAmount;
    }

    onAdd({
      amount: finalAmount,
      description,
      paidBy: paidByPayload,
      splitBetween,
      category: 'other'
    });
    onClose();
  };

  const toggleSplit = (id: string) => {
    setSplitBetween(prev => 
        prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleMultiPayerChange = (id: string, value: string) => {
      setMultiPayers(prev => ({...prev, [id]: value}));
  };

  // --- AI Logic ---
  const handleMagicFill = async () => {
    if (!magicText.trim()) return;
    setIsThinking(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Prepare context for the AI
        const friendsList = friends.map(f => ({
            id: f.id,
            name: f.name,
            isMe: f.id === currentUser.id
        }));

        const prompt = `
            I am a bill splitting assistant. 
            User Input: "${magicText}"
            
            Current User: ${currentUser.name} (ID: ${currentUser.id})
            Available Friends: ${JSON.stringify(friendsList)}

            Task: Analyze the input and extract structured expense data.

            Rules:
            1. **Total Amount**: Calculate the total cost. If multiple people paid specific amounts (e.g., "I paid 100, Bob paid 200"), sum them up.
            2. **Description**: A short, clear title (e.g., "Lunch", "Taxi").
            3. **Involved (Split Between)**: Who should share this cost?
               - If "everyone", "all", "us", or NO specific names are mentioned -> Include ALL friend IDs.
               - If specific names are mentioned -> Include only those IDs.
               - Always include "me" (Current User) unless explicitly excluded.
            4. **Payers (Who paid)**:
               - If not specified, assume Current User paid the full amount.
               - If "Bob paid", use Bob's ID.
               - If multiple people paid ("I paid 50, Bob paid 50"), return a list of payers with their amounts.

            Return JSON matching the schema.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        totalAmount: { type: Type.NUMBER },
                        description: { type: Type.STRING },
                        involvedFriendIds: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING } 
                        },
                        payers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    friendId: { type: Type.STRING },
                                    amount: { type: Type.NUMBER }
                                }
                            }
                        }
                    }
                }
            }
        });

        const result = JSON.parse(response.text || '{}');

        // 1. Set Description
        if (result.description) setDescription(result.description);
        
        // 2. Set Amount (Total)
        if (result.totalAmount) setAmount(result.totalAmount.toString());

        // 3. Set Payers
        if (result.payers && result.payers.length > 0) {
            const validPayers = result.payers.filter((p: any) => friends.some(f => f.id === p.friendId));
            
            if (validPayers.length === 1) {
                // Single Payer detected
                setIsMultiPayer(false);
                setSinglePayerId(validPayers[0].friendId);
                setMultiPayers({}); // Reset multi
            } else if (validPayers.length > 1) {
                // Multi Payer detected
                setIsMultiPayer(true);
                const newMultiMap: Record<string, string> = {};
                validPayers.forEach((p: any) => {
                    newMultiMap[p.friendId] = p.amount.toString();
                });
                setMultiPayers(newMultiMap);
            } else {
                // Fallback to me
                setIsMultiPayer(false);
                setSinglePayerId(currentUser.id);
            }
        } else {
            // Default to me if AI didn't specify
            setIsMultiPayer(false);
            setSinglePayerId(currentUser.id);
        }

        // 4. Set Split Participants
        if (result.involvedFriendIds && result.involvedFriendIds.length > 0) {
            const validIds = result.involvedFriendIds.filter((id: string) => friends.some(f => f.id === id));
            if (validIds.length > 0) {
                setSplitBetween(validIds);
            } else {
                 setSplitBetween(friends.map(f => f.id)); // Fallback
            }
        } else {
            setSplitBetween(friends.map(f => f.id)); // Default to everyone
        }

        setIsMagicMode(false); // Close magic mode to show filled form
        
    } catch (error) {
        console.error("AI Error:", error);
        alert("Не удалось распознать. Попробуйте перефразировать.");
    } finally {
        setIsThinking(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Новый расход">
        <div className="space-y-8 min-h-[400px]">
            
            {/* AI Input Mode */}
            {isMagicMode ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Что купили?</label>
                        <button onClick={() => setIsMagicMode(false)} className="text-zinc-500 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative">
                        <textarea
                            value={magicText}
                            onChange={(e) => setMagicText(e.target.value)}
                            placeholder="Например: Я заплатил 500 и Алекс 300 за такси"
                            className="w-full h-32 bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:bg-zinc-800 transition-all resize-none"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleMagicFill();
                                }
                            }}
                        />
                        <button 
                            onClick={handleMagicFill}
                            disabled={!magicText.trim() || isThinking}
                            className="absolute bottom-3 right-3 bg-white text-black p-2 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {isThinking ? <Sparkles className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="text-xs text-zinc-500 text-center">
                        ИИ понимает кто платил (даже если несколько человек).
                    </p>
                </div>
            ) : (
                <>
                    {/* Main Inputs */}
                    <div className="space-y-6">
                        <div>
                            <div className="relative flex items-center justify-center py-4">
                                <span className="text-3xl text-zinc-600 font-light mr-2">₽</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => !isMultiPayer && setAmount(e.target.value)}
                                    readOnly={isMultiPayer}
                                    placeholder="0"
                                    className={`bg-transparent text-center text-7xl font-bold text-white placeholder-zinc-800 outline-none w-full caret-white ${isMultiPayer ? 'opacity-80' : ''}`}
                                    autoFocus={!isMultiPayer}
                                    inputMode="decimal"
                                />
                            </div>
                            {isMultiPayer && <p className="text-center text-xs text-zinc-500">Сумма складывается из вкладов участников</p>}
                        </div>

                        <input 
                            type="text" 
                            placeholder="Название (например: Ужин)" 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-lg text-center text-white placeholder-zinc-600 focus:outline-none focus:bg-zinc-800 focus:border-zinc-700 transition-all"
                        />
                    </div>

                    {/* Config Sections */}
                    <div className="flex flex-col gap-4">
                        
                        {/* Payer Section */}
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden transition-all">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
                                <span className="text-sm font-bold text-zinc-500 uppercase tracking-wide">Кто платил</span>
                                <div className="flex bg-black rounded-lg p-1">
                                    <button 
                                        onClick={() => setIsMultiPayer(false)}
                                        className={`p-1.5 rounded-md transition-all ${!isMultiPayer ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        <User className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setIsMultiPayer(true)}
                                        className={`p-1.5 rounded-md transition-all ${isMultiPayer ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        <Users className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {!isMultiPayer ? (
                                <div className="p-4 flex -space-x-2 overflow-x-auto no-scrollbar">
                                    {friends.map(friend => (
                                        <button 
                                            key={friend.id} 
                                            onClick={() => setSinglePayerId(friend.id)}
                                            className={`relative rounded-full transition-transform hover:scale-105 ${singlePayerId === friend.id ? 'z-10 scale-110 ring-2 ring-white bg-black' : 'opacity-50 hover:opacity-100'}`}
                                        >
                                            <Avatar name={friend.name} src={friend.avatar} size="md" active={singlePayerId === friend.id} />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {friends.map(friend => (
                                        <div key={friend.id} className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <Avatar name={friend.name} src={friend.avatar} size="sm" />
                                                <span className="text-sm text-zinc-300">{friend.name.split(' ')[0]}</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input 
                                                    type="number" 
                                                    placeholder="0"
                                                    value={multiPayers[friend.id] || ''}
                                                    onChange={(e) => handleMultiPayerChange(friend.id, e.target.value)}
                                                    className="w-full bg-black/50 border border-zinc-700 rounded-lg py-1 px-2 text-right text-white focus:outline-none focus:border-zinc-500 transition-colors"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Splitters */}
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                            <button 
                                onClick={() => setExpandSplit(!expandSplit)}
                                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                            >
                                <span className="text-sm font-bold text-zinc-500 uppercase tracking-wide">
                                    Делим на {splitBetween.length === friends.length ? 'всех' : splitBetween.length}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expandSplit ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {expandSplit && (
                                <div className="px-4 pb-4 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                                    {friends.map(friend => {
                                        const isSelected = splitBetween.includes(friend.id);
                                        return (
                                            <button
                                                key={friend.id}
                                                onClick={() => toggleSplit(friend.id)}
                                                className={`flex items-center space-x-3 p-2 rounded-lg border transition-all ${
                                                    isSelected 
                                                    ? 'bg-white border-white shadow-sm' 
                                                    : 'bg-transparent border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-black bg-black' : 'border-zinc-600'}`}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`text-sm font-medium ${isSelected ? 'text-black' : 'text-zinc-500'}`}>
                                                    {friend.name.split(' ')[0]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button 
                            className="flex-1" 
                            size="lg"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !parseFloat(amount) || !description}
                        >
                            {isSubmitting ? '...' : `Добавить`}
                        </Button>

                        <button 
                            onClick={() => setIsMagicMode(true)}
                            className="px-5 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-purple-400 hover:border-purple-500 hover:text-purple-300 hover:bg-purple-500/10 transition-all active:scale-95 group shadow-sm"
                            title="AI Magic Fill"
                        >
                            <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
                        </button>
                    </div>
                </>
            )}
        </div>
    </BottomSheet>
  );
};