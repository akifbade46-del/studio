'use client';

import React, { useState, useMemo } from 'react';
import { useSettings } from '@/context/settings-context';
import { useSurvey } from '@/context/survey-context';
import type { SurveyItem } from '@/lib/types';
import { calculateCbm } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardTitle, CardDescription, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Trash2, PlusCircle, Box } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ItemForm = ({ onAddItem }: { onAddItem: (item: Omit<SurveyItem, 'id' | 'cbm'>) => void }) => {
  const { survey } = useSurvey();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [length, setLength] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || quantity <= 0 || length <= 0 || width <= 0 || height <= 0) {
      alert('Please fill all fields with valid values.');
      return;
    }
    onAddItem({ name, quantity, length, width, height, unit: survey.itemUnit });
    setName('');
    setQuantity(1);
    setLength(0);
    setWidth(0);
    setHeight(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Custom Item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="itemName">Item Name</Label>
            <Input id="itemName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Armchair" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemQty">Quantity</Label>
            <Input id="itemQty" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" />
          </div>
          <div className="space-y-2">
            <Label>L x W x H ({survey.itemUnit})</Label>
            <div className="flex gap-2">
              <Input type="number" value={length} onChange={e => setLength(Number(e.target.value))} placeholder="L" />
              <Input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} placeholder="W" />
              <Input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} placeholder="H" />
            </div>
          </div>
          <Button type="submit" className="col-span-2 md:col-span-1 w-full mt-4 md:mt-0">
            <PlusCircle className="mr-2" /> Add Item
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default function ItemListStep() {
  const { settings } = useSettings();
  const { survey, setSurvey } = useSurvey();

  const handleUnitChange = (unit: 'cm' | 'in') => {
    const newItems = survey.items.map(item => {
      const newItem = { ...item, unit };
      newItem.cbm = calculateCbm(newItem.length, newItem.width, newItem.height, unit);
      return newItem;
    });
    setSurvey({ ...survey, itemUnit: unit, items: newItems });
  };
  
  const addItem = (item: Omit<SurveyItem, 'id' | 'cbm'>) => {
    const cbm = calculateCbm(item.length, item.width, item.height, item.unit);
    setSurvey({
      ...survey,
      items: [...survey.items, { ...item, id: uuidv4(), cbm }],
    });
  };

  const addPreset = (preset: typeof settings.itemPresets[0]) => {
    addItem({ ...preset, quantity: 1 });
  };
  
  const updateItemQuantity = (id: string, quantity: number) => {
    const newItems = survey.items.map(item =>
      item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
    );
    setSurvey({ ...survey, items: newItems });
  };

  const removeItem = (id: string) => {
    setSurvey({ ...survey, items: survey.items.filter(item => item.id !== id) });
  };

  const totalCbm = useMemo(() => 
    survey.items.reduce((acc, item) => acc + item.cbm * item.quantity, 0),
    [survey.items]
  );
  
  return (
    <div className="space-y-8">
      <CardHeader className="p-0">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Item List & CBM Calculation</CardTitle>
            <CardDescription>Add items from presets or create custom entries.</CardDescription>
          </div>
          <div className="w-24">
            <Select value={survey.itemUnit} onValueChange={(value: 'cm' | 'in') => handleUnitChange(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="in">in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <div className="space-y-4">
        <h3 className="font-semibold">Presets</h3>
        <div className="flex flex-wrap gap-2">
          {settings.itemPresets.map(preset => (
            <Button key={preset.id} variant="outline" size="sm" onClick={() => addPreset(preset)}>
              <Box className="mr-2 h-4 w-4" />
              {preset.name}
            </Button>
          ))}
        </div>
      </div>
      
      <ItemForm onAddItem={addItem} />

      <Card>
        <CardHeader>
          <CardTitle>Added Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-[100px]">Qty</TableHead>
                  <TableHead>Dimensions ({survey.itemUnit})</TableHead>
                  <TableHead>CBM/Unit</TableHead>
                  <TableHead>Total CBM</TableHead>
                  <TableHead className="w-[50px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {survey.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      No items added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  survey.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          value={item.quantity}
                          onChange={e => updateItemQuantity(item.id, parseInt(e.target.value))}
                          min="0"
                        />
                      </TableCell>
                      <TableCell>{`${item.length}x${item.width}x${item.height}`}</TableCell>
                      <TableCell>{item.cbm.toFixed(3)}</TableCell>
                      <TableCell>{(item.cbm * item.quantity).toFixed(3)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold text-lg">Total CBM</TableCell>
                  <TableCell colSpan={2} className="font-bold text-lg text-primary">{totalCbm.toFixed(3)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
