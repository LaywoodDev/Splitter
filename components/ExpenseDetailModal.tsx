import React from 'react';
import { Trash2 } from 'lucide-react';
import { Expense, Friend } from '../types';
import { Button, Avatar, BottomSheet } from './UI';

interface ExpenseDetailModalProps {
  expense: Expense | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  friends: Friend[];
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({ expense, onClose, onDelete, friends }) => {
  if (!expense) return null;

  const date = new Date(expense.date);
  const myShare = expense.amount / expense.splitBetween.length;
  const payers = Object.entries(expense.paidBy);
  
  return (
    <BottomSheet isOpen={!!expense} onClose={onClose}>
        <div className="space-y-8">
            <div className="text-center pt-4">
                <h2 className="text-3xl font-bold text-white mb-2">{expense.description}</h2>
                <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
                    {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>

            <div className="flex justify-between items-center bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                <div>
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Сумма</p>
                    <p className="text-3xl font-bold text-white">
                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(expense.amount)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Ваша доля</p>
                    <p className="text-xl font-bold text-zinc-300">
                         {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(myShare)}
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                 {/* Payers Section */}
                 <div>
                    <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Оплатили</span>
                    <div className="space-y-2">
                        {payers.map(([payerId, amount]) => {
                            const payer = friends.find(f => f.id === payerId);
                            return (
                                <div key={payerId} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        <Avatar name={payer?.name || '?'} src={payer?.avatar} size="sm" />
                                        <span className="text-white font-medium">{payer?.name}</span>
                                    </div>
                                    <span className="text-white font-bold">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount as number)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                 </div>

                 <div className="h-px bg-zinc-800 w-full" />

                 {/* Consumers Section */}
                 <div>
                    <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Делим на ({expense.splitBetween.length})</span>
                    <div className="flex flex-wrap gap-2">
                        {expense.splitBetween.map(id => {
                            const f = friends.find(fr => fr.id === id);
                            return f ? (
                                <div key={id} className="flex items-center space-x-2 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                                    <Avatar name={f.name} size="sm" />
                                    <span className="text-sm text-zinc-300">{f.name.split(' ')[0]}</span>
                                </div>
                            ) : null
                        })}
                    </div>
                 </div>
            </div>

            <div className="pt-4">
                 <Button variant="danger" fullWidth onClick={() => { onDelete(expense.id); onClose(); }} className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Удалить запись</span>
                 </Button>
            </div>
        </div>
    </BottomSheet>
  );
};