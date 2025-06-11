import React, { useState, useRef, useEffect } from "react";
import "./styles.scss";

interface SelectorProps {
  text: string;
  options: string[];
  onChange: (arg1: string) => void;
  tabIndex?: number;
}

const Selector: React.FC<SelectorProps> = ({ text, options, onChange, tabIndex }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const selectorRef = useRef<HTMLDivElement | null>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option: string) => {
    setSelectedOption(option);
    onChange(option);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent, option: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOptionClick(option);
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      selectorRef?.current &&
      event.target instanceof Node &&
      !selectorRef.current.contains(event.target)
    ) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div 
      className={`selector`} 
      onClick={toggleOpen} 
      ref={selectorRef}
      tabIndex={tabIndex}
      role="button"
      onKeyDown={handleKeyDown}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    >
      <div className="label">
        <span>{selectedOption || text}</span>
        <svg
          width="8"
          height="5"
          viewBox="0 0 8 5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3.646 4.354L0.646004 1.354L1.354 0.645996L4 3.293L6.646 0.645996L7.354 1.354L4.354 4.354L4 4.707L3.646 4.354Z"
            fill="#333333"
          />
        </svg>
      </div>
      {isOpen && (
        <div className="options" role="listbox">
          {options.map((option, index) => (
            <div
              key={index}
              className="option"
              onClick={() => handleOptionClick(option)}
              onKeyDown={(e) => handleOptionKeyDown(e, option)}
              tabIndex={0}
              role="option"
              aria-selected={selectedOption === option}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Selector;

