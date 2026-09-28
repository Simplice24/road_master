export type QuestionType = "TEXT" | "TEXT_IMAGE";
export type TransactionType = "TOPUP" | "EXAM_FEE" | "REFUND";
export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED";
export type ExamAttemptStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  walletBalance: string;
  hasUsedFreeExam: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamConfig {
  id: string;
  name: string;
  numberOfQuestions: number;
  price: string;
  passMarkPercent: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface Option {
  id: string;
  text: string | null;
  imageUrl: string | null;
  isCorrect?: boolean;
}

export interface AttemptQuestion {
  order: number;
  question: {
    id: string;
    type: QuestionType;
    text: string;
    imageUrl: string | null;
    allowMultiple: boolean;
    explanation?: string | null;
    options: Option[];
  };
}

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect?: boolean;
  answeredAt: string;
}

export interface ExamAttempt {
  id: string;
  userId: string;
  examConfigId: string;
  categoryId: string | null;
  transactionId: string | null;
  isFree: boolean;
  status: ExamAttemptStatus;
  totalQuestions: number;
  score: number;
  percentage: string;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
  examConfig?: ExamConfig;
  questions?: AttemptQuestion[];
  answers?: AttemptAnswer[];
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  isReversed: boolean;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
}
