import React, { useState, useMemo, useEffect } from 'react';
import { Home, Users, User, Plus, Search } from 'lucide-react';
import { Friend, Expense, Profile, FriendRequest } from './types';
import { Button, Avatar } from './components/UI';
import { AddExpenseModal } from './components/AddExpenseModal';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { ProfileView } from './components/ProfileModal'; 
import { Auth } from './components/Auth';
import { supabase } from './supabaseClient';

// Currency formatter
const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0
    }).format(amount);
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'home' | 'friends' | 'profile'>('home');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // --- Data Loading ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchUserData(session.user.id);
      } else {
          setLoading(false);
      }
    }).catch(err => {
        console.error("Auth initialization error:", err);
        setLoading(false); // Ensure we don't get stuck on loading
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          fetchUserData(session.user.id);
      } else {
        setFriends([]);
        setExpenses([]);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
      if (session?.user?.id) fetchUserData(session.user.id);
  }, [activeTab, isAddModalOpen, selectedExpense]);

  const fetchUserData = async (userId?: string) => {
    const uid = userId || userProfile?.id;
    if (!uid) return;

    try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single();
        if (profile) {
            setUserProfile(profile);
        }

        const { data: reqs } = await supabase
            .from('friend_requests')
            .select('*, sender:sender_id(*), receiver:receiver_id(*)')
            .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
        
        const confirmed: Friend[] = profile ? [{...profile, isMe: true}] : [];
        const pending: FriendRequest[] = [];

        reqs?.forEach((req: any) => {
            if (req.status === 'accepted') {
                const friend = req.sender_id === uid ? req.receiver : req.sender;
                if (!confirmed.find(f => f.id === friend.id)) confirmed.push({...friend, isMe: false});
            } else if (req.status === 'pending' && req.receiver_id === uid) {
                pending.push(req);
            }
        });

        setFriends(confirmed);
        setRequests(pending);

        // Fetch expenses. Note: We assume paid_by is stored as JSONB in Supabase. 
        // If it's a legacy string column, this code adapts.
        const { data: exps } = await supabase.from('expenses').select('*').order('date', { ascending: false });
        
        const formattedExpenses: Expense[] = (exps || []).map((e: any) => {
            // Handle legacy string paid_by vs new JSON paid_by
            let paidByMap: Record<string, number> = {};
            if (typeof e.paid_by === 'string') {
                // Legacy: string ID means they paid the full amount
                paidByMap[e.paid_by] = e.amount;
            } else if (typeof e.paid_by === 'object' && e.paid_by !== null) {
                paidByMap = e.paid_by;
            }

            return {
                id: e.id, 
                description: e.description, 
                amount: e.amount, 
                paidBy: paidByMap,
                splitBetween: e.split_between || [], 
                date: e.date, 
                category: e.category, 
                createdBy: e.created_by
            };
        });
        setExpenses(formattedExpenses);

    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleAddExpense = async (newExpenseData: Omit<Expense, 'id' | 'date'>) => {
    if (!userProfile) return;
    try {
      // Determine format for paid_by (String ID for single payer compatibility, JSON for multi-payer)
      const payerIds = Object.keys(newExpenseData.paidBy);
      let paidByPayload: any = newExpenseData.paidBy;

      // Compatibility Check: If strict single payer (amount matches), send string to avoid DB Type Error
      if (payerIds.length === 1) {
          const singlePayerId = payerIds[0];
          // Check if floating point logic holds (e.g. they paid the full amount)
          if (Math.abs(newExpenseData.paidBy[singlePayerId] - newExpenseData.amount) < 0.01) {
              paidByPayload = singlePayerId;
          }
      }

      const payload = {
        description: newExpenseData.description,
        amount: newExpenseData.amount,
        paid_by: paidByPayload, 
        split_between: newExpenseData.splitBetween,
        category: newExpenseData.category,
        date: new Date().toISOString(),
        created_by: userProfile.id
      };
      
      const { error } = await supabase.from('expenses').insert([payload]);
      if (error) throw error;

      fetchUserData(); 
    } catch (e: any) { 
        console.error("Error saving expense:", e);
        alert(`Ошибка сохранения: ${e.message || e.details || 'Проверьте консоль'}`); 
    }
  };

  const handleDeleteExpense = async (id: string) => {
      await supabase.from('expenses').delete().eq('id', id);
      fetchUserData();
  };

  const handleAcceptRequest = async (id: string) => {
      await supabase.from('friend_requests').update({status: 'accepted'}).eq('id', id);
      fetchUserData();
  };

  // New function to remove a friend connection
  const handleRemoveFriend = async (friendId: string) => {
    if (!userProfile) return;
    try {
        const { error } = await supabase
            .from('friend_requests')
            .delete()
            .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userProfile.id})`);
        
        if (error) throw error;
        fetchUserData();
    } catch (e) {
        console.error("Error removing friend:", e);
    }
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setUserProfile(updatedProfile);
    // Also update the 'friends' array where 'isMe' is true, so avatars update everywhere instantly
    setFriends(prev => prev.map(f => f.id === updatedProfile.id ? { ...f, ...updatedProfile } : f));
  };

  // --- Advanced Balance Calculation (Multi-Payer Support) ---
  const balances = useMemo(() => {
    const bals: Record<string, number> = {}; // Net balance per friend relative to Current User
    
    // Initialize
    friends.forEach(f => {
        if (!f.isMe) bals[f.id] = 0;
    });

    if (!userProfile) return [];

    expenses.forEach(exp => {
        const costPerPerson = exp.amount / exp.splitBetween.length;
        
        // Who consumed?
        const consumers = exp.splitBetween;
        
        // Who paid? (Array of [id, amount])
        const payers = Object.entries(exp.paidBy);

        // Algorithm: Calculate debts relative to the Payers.
        consumers.forEach(consumerId => {
            // How much does this consumer owe to the pot?
            // They owe `costPerPerson`.
            // Who do they owe it to? To the payers, proportionally to how much the payers put in.
            
            payers.forEach(([payerId, paidAmount]) => {
                 const amount = paidAmount as number;
                 const weight = amount / exp.amount; // % of the total bill this person paid
                 const debtChunk = costPerPerson * weight;

                 // Case 1: Current User is the Payer, Friend is Consumer
                 if (payerId === userProfile.id && consumerId !== userProfile.id) {
                     bals[consumerId] = (bals[consumerId] || 0) + debtChunk;
                 }
                 
                 // Case 2: Friend is Payer, Current User is Consumer
                 if (payerId !== userProfile.id && consumerId === userProfile.id) {
                     bals[payerId] = (bals[payerId] || 0) - debtChunk;
                 }

                 // Note: Friend vs Friend debts don't affect Current User's display balance, so we ignore them here.
            });
        });
    });

    return Object.entries(bals).map(([id, amount]) => ({ friendId: id, amount }));
  }, [expenses, userProfile, friends]);

  const totalBalance = balances.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading) {
      return (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
      )
  }

  if (!session || !userProfile) return <Auth />;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 relative z-10">
        <div className="max-w-md mx-auto min-h-full">
            
            {/* TAB: HOME */}
            {activeTab === 'home' && (
                <div className="p-6 space-y-12 animate-in fade-in duration-500">
                    <div className="pt-8 relative">
                        <div className="flex items-center space-x-2 mb-4">
                             <Avatar name={userProfile.name} src={userProfile.avatar} size="sm" />
                             <span className="text-zinc-400 text-sm font-medium">Привет, {userProfile.name.split(' ')[0]}</span>
                        </div>
                        <h1 className={`text-5xl font-medium tracking-tighter ${totalBalance >= 0 ? 'text-white' : 'text-red-500'}`}>
                            {formatMoney(Math.abs(totalBalance))}
                        </h1>
                        <p className="text-zinc-500 text-sm mt-2 font-medium">
                            {Math.abs(totalBalance) < 1 ? "Всё ровно." : totalBalance > 0 ? 'Вам должны.' : 'Вы должны.'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end border-b border-zinc-800 pb-2">
                             <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Транзакции</h2>
                        </div>
                        
                        {expenses.length === 0 ? (
                            <div className="py-10 text-center">
                                <p className="text-zinc-600 mb-2">История пуста</p>
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-3">
                                {expenses.map(expense => {
                                    const myId = userProfile.id;
                                    const cost = expense.amount / expense.splitBetween.length;
                                    const iPaid = expense.paidBy[myId] || 0;
                                    const iConsumed = expense.splitBetween.includes(myId) ? cost : 0;
                                    const netChange = iPaid - iConsumed;

                                    const payerIds = Object.keys(expense.paidBy);
                                    const isMultiPayer = payerIds.length > 1;
                                    const primaryPayerName = friends.find(f => f.id === payerIds[0])?.name.split(' ')[0] || 'Unknown';

                                    return (
                                        <div 
                                            key={expense.id} 
                                            onClick={() => setSelectedExpense(expense)}
                                            className="group flex justify-between items-center p-4 bg-zinc-900 border border-zinc-800 rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="bg-zinc-800 p-2 rounded-full text-lg">
                                                    {expense.category === 'food' ? '🍔' : '💸'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white leading-none mb-1">{expense.description}</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
                                                        {isMultiPayer 
                                                            ? `Скидывались (${payerIds.length})` 
                                                            : (iPaid > 0 ? 'Вы платили' : `${primaryPayerName} платил`)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                 <span className={`text-sm font-bold ${netChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {netChange > 0 ? '+' : ''}{formatMoney(netChange)}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: FRIENDS */}
            {activeTab === 'friends' && (
                <div className="p-6 space-y-8 animate-in fade-in duration-500 pt-16">
                    <h1 className="text-4xl font-bold tracking-tighter">Контакты</h1>
                    
                    {requests.length > 0 && (
                        <div className="space-y-2">
                             <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Запросы</h3>
                             {requests.map(req => (
                                <div key={req.id} className="flex justify-between items-center bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                                    <div className="flex items-center space-x-3">
                                        <Avatar name={req.sender?.name || '?'} src={req.sender?.avatar} size="sm" />
                                        <span className="text-sm font-bold">{req.sender?.name}</span>
                                    </div>
                                    <Button size="sm" onClick={() => handleAcceptRequest(req.id)} className="bg-white text-black py-1 px-3 text-xs h-auto">OK</Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        {friends.filter(f => !f.isMe).length === 0 ? (
                             <p className="text-zinc-600 text-center py-10">Список друзей пуст</p>
                        ) : (
                            friends.filter(f => !f.isMe).map(friend => {
                                 const bal = balances.find(b => b.friendId === friend.id)?.amount || 0;
                                 return (
                                    <div key={friend.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                                        <div className="flex items-center space-x-4">
                                            <Avatar name={friend.name} src={friend.avatar} />
                                            <p className="font-bold text-white">{friend.name}</p>
                                        </div>
                                        {Math.abs(bal) > 1 ? (
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${bal > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {bal > 0 ? '+' : ''}{formatMoney(bal)}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-600 text-xs font-bold">0 ₽</span>
                                        )}
                                    </div>
                                 )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
                 <ProfileView 
                    currentUser={userProfile} 
                    friends={friends}
                    onLogout={async () => await supabase.auth.signOut()} 
                    onUpdateProfile={handleProfileUpdate}
                    onRemoveFriend={handleRemoveFriend}
                 />
            )}
        </div>
      </div>

      {/* NAVIGATION BAR */}
      <div className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto">
         <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl h-16 p-1.5 flex items-center justify-between shadow-2xl gap-1">
             
             <button 
                onClick={() => setActiveTab('home')}
                className={`flex-1 h-full flex items-center justify-center rounded-xl transition-all duration-200 ${activeTab === 'home' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                <Home className="w-6 h-6" strokeWidth={activeTab === 'home' ? 2.5 : 2} />
             </button>

             <button 
                onClick={() => setActiveTab('friends')}
                className={`flex-1 h-full flex items-center justify-center rounded-xl transition-all duration-200 ${activeTab === 'friends' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                <Users className="w-6 h-6" strokeWidth={activeTab === 'friends' ? 2.5 : 2} />
             </button>

             {/* Add Button - Unified Look */}
             <button 
                onClick={() => setIsAddModalOpen(true)}
                className={`flex-1 h-full flex items-center justify-center rounded-xl transition-all duration-200 ${isAddModalOpen ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
             >
                <Plus className="w-6 h-6" strokeWidth={isAddModalOpen ? 2.5 : 2} />
             </button>

             <button 
                onClick={() => setActiveTab('profile')}
                className={`flex-1 h-full flex items-center justify-center rounded-xl transition-all duration-200 ${activeTab === 'profile' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                <User className="w-6 h-6" strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
             </button>

         </div>
      </div>

      <AddExpenseModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        friends={friends}
        currentUser={userProfile}
        onAdd={handleAddExpense}
      />

      <ExpenseDetailModal 
        expense={selectedExpense}
        friends={friends}
        onClose={() => setSelectedExpense(null)}
        onDelete={handleDeleteExpense}
      />

    </div>
  );
};

export default App;