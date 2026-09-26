import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Lightbulb, AlertCircle, MessageSquare, Users, UserCheck, ExternalLink, BookOpen, Trophy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '../pages/UserContext';

interface FABAction {
  icon: React.ElementType;
  label: string;
  action: () => void;
  color: string;
}

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  // Hide FAB if user is not logged in
  if (!user) {
    return null;
  }

  // Get context-aware actions based on current page
  const getActions = (): FABAction[] => {
    const baseActions: FABAction[] = [
      {
        icon: AlertCircle,
        label: 'Add Problem',
        action: () => {
          navigate('/problems?action=submit');
          setIsOpen(false);
        },
        color: 'text-pink-400'
      },
      {
        icon: Lightbulb,
        label: 'Add Idea',
        action: () => {
          navigate('/ideas?action=submit');
          setIsOpen(false);
        },
        color: 'text-lime-400'
      },
      {
        icon: MessageSquare,
        label: 'Give Feedback',
        action: () => {
          // Replace with your actual Google Form URL
          window.open('https://forms.gle/MoSnmC9PhxXq5CmD9', '_blank');
          setIsOpen(false);
        },
        color: 'text-white'
      }
    ];

    const currentPath = location.pathname;

    if (currentPath === '/startups') {
      baseActions.unshift({
        icon: Trophy,
        label: 'Submit Startup',
        action: () => {
          navigate('/startup-form');
          setIsOpen(false);
        },
        color: 'text-violet-400'
      });
    }


    // Always add help as last option
    baseActions.push({
      icon: ExternalLink,
      label: 'Get Help',
      action: () => {
        // Replace with your actual community/help link
        window.open('https://chat.whatsapp.com/IBfChZgpT8qJoHKbBWMvqA', '_blank');
        setIsOpen(false);
      },
      color: 'text-white'
    });

    return baseActions;
  };

  const actions = getActions();

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 mb-safe mr-safe">
        {/* Action Items */}
        <div className={`flex flex-col-reverse items-end space-y-reverse space-y-3 mb-4 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          {actions.map((action, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <button
                  onClick={action.action}
                  aria-label={action.label}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/75 backdrop-blur-md transition-transform duration-300 hover:scale-110 hover:border-white/30 ${action.color}`}
                  style={{
                    animation: `bounceIn 0.5s ease-out ${index * 50}ms backwards`
                  }}
                >
                  <action.icon size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="border-white/10 bg-black text-white font-mono text-[10px] uppercase tracking-[0.12em]">
                <p>{action.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Main FAB - Enhanced size and glow animation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
              aria-expanded={isOpen}
              className={`flex h-[56px] w-[56px] items-center justify-center rounded-full bg-lime-400 text-black shadow-[0_12px_32px_-10px_rgba(215,255,99,0.55)] transition-transform duration-300 hover:scale-105 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
            >
              <Plus size={26} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="border-white/10 bg-black text-white font-mono text-[10px] uppercase tracking-[0.12em]">
            <p>{isOpen ? 'Close actions' : 'Quick actions'}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </TooltipProvider>
  );
};

export default FloatingActionButton;