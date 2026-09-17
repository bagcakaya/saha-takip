import React from 'react';
import { TimedFollowUpsSection } from '../components/timedFollowUps/TimedFollowUpsSection';

export const TimedFollowUpsView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      <TimedFollowUpsSection />
    </div>
  );
};
