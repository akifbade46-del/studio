'use client';

import React, { useState } from 'react';
import { useSettings } from '@/context/settings-context';
import type { ItemPreset } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function ItemPresetsTab() {
    const { settings, setSettings } = useSettings();
    const [newItem, setNewItem] = useState<Omit<ItemPreset, 'id'>>({
        name: '',
        length: 0,
        width: 0,
        height: 0,
        unit: 'cm',
        price: 0,
    });

    const handleInputChange = (field: keyof typeof newItem, value: string | number) => {
        setNewItem(prev => ({ ...prev, [field]: value }));
    };

    const handleUnitChange = (unit: 'cm' | 'in') => {
        setNewItem(prev => ({ ...prev, unit }));
    };

    const handleAddItem = () => {
        if (!newItem.name || newItem.price < 0 || newItem.length <= 0 || newItem.width <= 0 || newItem.height <= 0) {
            alert('Please fill in all fields with valid values.');
            return;
        }
        setSettings({
            ...settings,
            itemPresets: [...settings.itemPresets, { ...newItem, id: uuidv4() }],
        });
        // Reset form
        setNewItem({ name: '', length: 0, width: 0, height: 0, unit: 'cm', price: 0 });
    };

    const handleUpdateItem = (id: string, field: keyof ItemPreset, value: string | number) => {
        const updatedPresets = settings.itemPresets.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        );
        setSettings({ ...settings, itemPresets: updatedPresets });
    };

    const handleDeleteItem = (id: string) => {
        if (confirm('Are you sure you want to delete this preset item?')) {
            const updatedPresets = settings.itemPresets.filter(item => item.id !== id);
            setSettings({ ...settings, itemPresets: updatedPresets });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Preset</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={newItem.name} onChange={e => handleInputChange('name', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Packing Price ({settings.rateSettings.currency})</Label>
                            <Input type="number" value={newItem.price} onChange={e => handleInputChange('price', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                             <Label>Dimensions (L x W x H)</Label>
                             <div className="flex gap-2">
                                <Input type="number" placeholder="L" value={newItem.length} onChange={e => handleInputChange('length', parseFloat(e.target.value) || 0)} />
                                <Input type="number" placeholder="W" value={newItem.width} onChange={e => handleInputChange('width', parseFloat(e.target.value) || 0)} />
                                <Input type="number" placeholder="H" value={newItem.height} onChange={e => handleInputChange('height', parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                         <div className="space-y-2">
                             <Label>Unit</Label>
                            <Select value={newItem.unit} onValueChange={handleUnitChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cm">cm</SelectItem>
                                    <SelectItem value="in">in</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button onClick={handleAddItem}><PlusCircle /> Add Preset</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Presets</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Dimensions (LxWxH)</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {settings.itemPresets.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Input value={item.name} onChange={e => handleUpdateItem(item.id, 'name', e.target.value)} className="h-8" />
                                        </TableCell>
                                        <TableCell>{`${item.length}x${item.width}x${item.height} ${item.unit}`}</TableCell>
                                        <TableCell>
                                            <Input type="number" value={item.price} onChange={e => handleUpdateItem(item.id, 'price', parseFloat(e.target.value) || 0)} className="h-8 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
