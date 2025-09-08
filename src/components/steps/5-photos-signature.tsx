'use client';

import React, { useRef } from 'react';
import { useSurvey } from '@/context/survey-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Trash2, Upload } from 'lucide-react';
import SignaturePad from '../signature-pad';
import { compressImage } from '@/lib/utils';
import type { Photo } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

export default function PhotosSignatureStep() {
  const { survey, setSurvey } = useSurvey();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newPhotos: Photo[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressedDataUrl = await compressImage(file);
        newPhotos.push({ id: uuidv4(), dataUrl: compressedDataUrl });
      } catch (error) {
        console.error("Error compressing image:", error);
      }
    }

    setSurvey({ ...survey, photos: [...survey.photos, ...newPhotos] });
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const removePhoto = (id: string) => {
    setSurvey({ ...survey, photos: survey.photos.filter(p => p.id !== id) });
  };
  
  const handleSignatureEnd = (signature: string) => {
    setSurvey({
      ...survey,
      signature: {
        dataUrl: signature,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const clearSignature = () => {
    setSurvey({ ...survey, signature: null });
  };


  return (
    <div className="space-y-8">
      <CardHeader className="p-0">
        <CardTitle>Photos & Signature</CardTitle>
        <CardDescription>
          Capture photos of the items and get the customer's signature.
        </CardDescription>
      </CardHeader>

      <Card>
        <CardHeader>
          <CardTitle>Item Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {survey.photos.map(photo => (
              <div key={photo.id} className="relative group aspect-square">
                <Image
                  src={photo.dataUrl}
                  alt="Survey item"
                  fill
                  className="rounded-md object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePhoto(photo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload Photos
            </Button>
             <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Use Camera
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Signature</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-48 border rounded-md bg-muted/20">
             <SignaturePad onSignatureEnd={handleSignatureEnd} initialDataUrl={survey.signature?.dataUrl}/>
          </div>
          <div className="mt-4 flex justify-end">
             <Button variant="ghost" onClick={clearSignature} disabled={!survey.signature}>
              Clear Signature
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
