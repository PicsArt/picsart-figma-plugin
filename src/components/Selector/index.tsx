import React, { useState, useRef, useEffect } from 'react';
import './styles.scss';

const ArrowRight = 'arrow_right';
const ArrowDown = 'keyboard_arrow_down';

interface SelectorProps {
    text: string;
    options: string[];
    onChange: (arg1 : string) => void;
}

const Selector : React.FC<SelectorProps> = ({ text, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const selectorRef = useRef<HTMLDivElement | null>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option : string) => {
    setSelectedOption(option);
    
    onChange(option);
    setIsOpen(false);
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`selector`} onClick={toggleOpen} ref={selectorRef}>
        <div className="label">
            <span>{selectedOption || text }</span>
            {!isOpen ?  <i className="icon"> {ArrowRight} </i>
            : <i className="icon"> { ArrowDown } </i>
            }
        </div>
        {isOpen && (
            <div className="options">
            {options.map((option, index) => (
                <div 
                  key={index} 
                  className="option" 
                  onClick={() => handleOptionClick(option)}
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
