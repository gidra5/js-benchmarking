import React, { useState, useEffect } from 'react';
import { render, Text } from 'ink';

const Counter = () => {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCounter((previousCounter) => {
        if (previousCounter > 50) {
          clearInterval(timer);
        }
        return previousCounter + 1;
      });
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <Text color="green">{counter} tests passed</Text>;
};

export const ui = () => {
  render(<Counter />);
};