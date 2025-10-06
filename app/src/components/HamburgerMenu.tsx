import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HamburgerMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleComparisonTrails = () => {
    navigate('/comparison-trails');
    setIsOpen(false);
  };

  const handleEnvVars = () => {
    navigate('/env-vars');
    setIsOpen(false);
  };

  const handleSeedingProgress = () => {
    navigate('/seeding-progress');
    setIsOpen(false);
  };

  return (
    <div className="hamburger-menu">
      <button 
        className="hamburger-button" 
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
      </button>

      {isOpen && (
        <div className="menu-overlay" onClick={() => setIsOpen(false)}>
          <div className="menu-content" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h3>Menu</h3>
              <button 
                className="close-button" 
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
            <nav className="menu-nav">
              <button 
                className="menu-item" 
                onClick={handleComparisonTrails}
              >
                📊 Set Comparison Trails
              </button>
              <button 
                className="menu-item" 
                onClick={handleSeedingProgress}
              >
                📈 Seeding Progress
              </button>
              <button 
                className="menu-item" 
                onClick={handleEnvVars}
              >
                ⚙️ Environment Variables
              </button>
            </nav>
          </div>
        </div>
      )}

      <style jsx>{`
        .hamburger-menu {
          position: relative;
        }

        .hamburger-button {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          width: 30px;
          height: 30px;
          padding: 0;
          z-index: 1001;
        }

        .hamburger-line {
          width: 100%;
          height: 3px;
          background: #333;
          transition: all 0.3s ease;
          transform-origin: center;
        }

        .hamburger-line.open:nth-child(1) {
          transform: rotate(45deg) translate(6px, 6px);
        }

        .hamburger-line.open:nth-child(2) {
          opacity: 0;
        }

        .hamburger-line.open:nth-child(3) {
          transform: rotate(-45deg) translate(6px, -6px);
        }

        .menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding: 20px;
        }

        .menu-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          min-width: 280px;
          max-width: 400px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 20px 10px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .menu-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.2em;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6c757d;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-button:hover {
          color: #333;
        }

        .menu-nav {
          padding: 10px 0;
        }

        .menu-item {
          width: 100%;
          background: none;
          border: none;
          padding: 15px 20px;
          text-align: left;
          cursor: pointer;
          font-size: 16px;
          color: #333;
          transition: background-color 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .menu-item:hover {
          background: #f8f9fa;
        }

        .menu-item:active {
          background: #e9ecef;
        }

        @media (max-width: 768px) {
          .menu-overlay {
            padding: 10px;
          }
          
          .menu-content {
            min-width: 250px;
          }
        }
      `}</style>
    </div>
  );
};

export default HamburgerMenu;
