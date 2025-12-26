export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
  sender?: Profile; // Joined data
  receiver?: Profile; // Joined data
}

// Helper type for UI
export interface Friend extends Profile {
  isMe?: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: Record<string, number>; // Changed from string to Map: { userId: amount }
  splitBetween: string[]; // Array of Profile IDs
  date: string;
  category: 'food' | 'transport' | 'entertainment' | 'other';
  createdBy?: string;
}

export interface Balance {
  friendId: string;
  amount: number; // Positive = they owe you, Negative = you owe them
}