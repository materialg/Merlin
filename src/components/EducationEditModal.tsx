import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, GraduationCap, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Education } from '../types';

interface EducationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (educationHistory: Education[]) => void;
  initialHistory: Education[];
  candidateName: string;
}

export default function EducationEditModal({ isOpen, onClose, onSave, initialHistory, candidateName }: EducationEditModalProps) {
  const [history, setHistory] = useState<Education[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(initialHistory || []);
    }
  }, [isOpen, initialHistory]);

  const handleAddEntry = () => {
    setHistory([...history, { school: '', degree: '', field: '', year: '' }]);
  };

  const handleRemoveEntry = (index: number) => {
    setHistory(history.filter((_, i) => i !== index));
  };

  const handleUpdateEntry = (index: number, updates: Partial<Education>) => {
    setHistory(history.map((edu, i) => i === index ? { ...edu, ...updates } : edu));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Education</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Managing education history for {candidateName}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No education history recorded.</p>
                  <button
                    onClick={handleAddEntry}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Entry
                  </button>
                </div>
              ) : (
                history.map((edu, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 relative group">
                    <button
                      onClick={() => handleRemoveEntry(index)}
                      className="absolute top-4 right-4 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">School / University</label>
                        <input
                          type="text"
                          value={edu.school}
                          onChange={(e) => handleUpdateEntry(index, { school: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. Stanford University"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Degree</label>
                        <input
                          type="text"
                          value={edu.degree || ''}
                          onChange={(e) => handleUpdateEntry(index, { degree: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. BS, MS, PhD"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Field of Study</label>
                        <input
                          type="text"
                          value={edu.field || ''}
                          onChange={(e) => handleUpdateEntry(index, { field: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. Computer Science"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Year / Period</label>
                        <input
                          type="text"
                          value={edu.year || ''}
                          onChange={(e) => handleUpdateEntry(index, { year: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. 2018 - 2022"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {history.length > 0 && (
                <button
                  onClick={handleAddEntry}
                  className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Education Entry
                </button>
              )}
            </div>

            <div className="flex items-center justify-end mt-8 gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(history)}
                className="flex items-center gap-2 px-8 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
