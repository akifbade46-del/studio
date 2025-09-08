'use client';

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSignatureEnd: (signature: string) => void;
  initialDataUrl?: string;
  className?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureEnd, initialDataUrl, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const getContext = () => canvasRef.current?.getContext('2d');

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas && canvas.parentElement) {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
      const ctx = getContext();
      if (ctx) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (initialDataUrl && !hasSigned) {
          const img = new Image();
          img.src = initialDataUrl;
          img.onload = () => ctx.drawImage(img, 0, 0);
          setHasSigned(true);
        } else if (!hasSigned) {
            drawPlaceholder(ctx, canvas.width, canvas.height);
        }
      }
    }
  };
  
  const drawPlaceholder = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.font = "16px Inter";
    ctx.fillStyle = "#a1a1aa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sign here", width / 2, height / 2);
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataUrl, hasSigned]);

  const getCoords = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e instanceof MouseEvent) {
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    if (!hasSigned) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        setHasSigned(true);
    }
    const { x, y } = getCoords(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = getCoords(e.nativeEvent);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const ctx = getContext();
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
    onSignatureEnd(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      className={cn("w-full h-full", className)}
    />
  );
};

export default SignaturePad;
