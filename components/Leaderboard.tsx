/* =========================================
   components/Leaderboard.tsx
========================================= */
"use client";

import { motion } from "framer-motion";
import { Trophy, Star, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
  name: string;
  stars: number;
  avatar: string;
  isOnline: boolean;
};

export default function Leaderboard({ students }: { students: Student[] }) {
  // Sort students by stars (highest first)
  const sortedStudents = [...students].sort((a, b) => b.stars - a.stars);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      <header className="text-center space-y-2">
        <h2 className="text-5xl font-black text-blue-900 italic uppercase tracking-tighter">
          Hall of <span className="text-pink-500">Heroes</span>
        </h2>
        <p className="text-blue-400 font-bold uppercase tracking-widest text-sm">Who is the top explorer today?</p>
      </header>

      <div className="grid gap-4">
        {sortedStudents.map((student, index) => {
          const isTopThree = index < 3;
          const rankColors = [
            "bg-yellow-100 border-yellow-400 text-yellow-700", // 1st
            "bg-slate-100 border-slate-300 text-slate-500",   // 2nd
            "bg-orange-100 border-orange-300 text-orange-700", // 3rd
          ];

          return (
            <motion.div
              key={student.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative flex items-center justify-between p-5 rounded-[35px] border-4 bg-white shadow-xl transition-all hover:scale-[1.02]",
                isTopThree ? rankColors[index] : "border-blue-50 text-blue-900"
              )}
            >
              <div className="flex items-center gap-6">
                {/* Rank Icon */}
                <div className="w-12 flex justify-center items-center font-black text-3xl italic">
                  {index === 0 && <Crown className="text-yellow-500 animate-bounce" size={40} />}
                  {index === 1 && <Medal className="text-slate-400" size={36} />}
                  {index === 2 && <Medal className="text-orange-400" size={36} />}
                  {index > 2 && `#${index + 1}`}
                </div>

                {/* Avatar with Online Status */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-blue-200 border-4 border-white overflow-hidden shadow-md">
                    <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                  </div>
                  {student.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full animate-pulse" />
                  )}
                </div>

                <span className="text-2xl font-black uppercase tracking-tight italic">
                  {student.name}
                </span>
              </div>

              {/* Star Count */}
              <div className="flex items-center gap-3 bg-white px-6 py-2 rounded-2xl border-2 border-current shadow-inner">
                <Star fill="currentColor" size={24} />
                <span className="text-2xl font-black tracking-tighter">{student.stars}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}