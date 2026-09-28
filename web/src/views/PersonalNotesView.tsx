import React from 'react';
import { PersonalNotesSection } from '../components/notes/PersonalNotesSection';

export const PersonalNotesView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <PersonalNotesSection />
    </div>
  );
};
