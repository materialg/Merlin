import React, { useState } from 'react';
import { Plus, Search, Briefcase, Trash2, Users, Calendar, ChevronRight } from 'lucide-react';
import { Project, Contact } from '../types';
import { motion } from 'motion/react';

interface ProjectsViewProps {
  projects: Project[];
  contacts: Contact[];
  onAddProject: (name: string, description?: string) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onDeleteProject: (id: string) => void;
}

export default function ProjectsView({ projects, contacts, onAddProject, onDeleteProject }: ProjectsViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    onAddProject(newName.trim(), newDescription.trim());
    setNewName('');
    setNewDescription('');
    setIsAdding(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Projects ({projects.length})</h1>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-blue-50/50 border border-blue-100 rounded-2xl"
          >
            <h2 className="text-sm font-bold text-blue-900 mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-blue-900/40 uppercase tracking-wider mb-1.5">Project Name</label>
                <input 
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer - Q3"
                  className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-blue-900/40 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                <textarea 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this project for?"
                  className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none h-24"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Project
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => {
            const projectContacts = contacts.filter(c => c.projects?.includes(project.name));
            return (
              <motion.div 
                key={project.id}
                layout
                className="group p-5 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all cursor-pointer relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="text-base font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                  {project.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-4 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    {projectContacts.length} Candidates
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <ChevronRight className="w-5 h-5 text-blue-600" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && !isAdding && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-200" />
            </div>
            <h3 className="text-gray-900 font-bold mb-1">No projects found</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              Create your first project to start organizing your talent pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
