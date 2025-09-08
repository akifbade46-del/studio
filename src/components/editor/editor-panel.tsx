'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/context/editor-context';
import { useSettings } from '@/context/settings-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { exportJson, importJson } from '@/lib/utils';
import { DEFAULT_EDITOR_SETTINGS } from '@/lib/consts';
import SavedSurveysTab from './saved-surveys-tab';
import ItemPresetsTab from './item-presets-tab';

const CompanyInfoTab = () => {
    const { settings, setSettings } = useSettings();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings({ ...settings, companyInfo: { ...settings.companyInfo, [e.target.name]: e.target.value } });
    };
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Company Name</Label>
                <Input name="name" value={settings.companyInfo.name} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label>Address</Label>
                <Input name="address" value={settings.companyInfo.address} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" value={settings.companyInfo.phone} onChange={handleChange} />
            </div>
             <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" value={settings.companyInfo.email} onChange={handleChange} />
            </div>
        </div>
    );
};

const RatesTab = () => {
    const { settings, setSettings } = useSettings();
    const { rateSettings } = settings;

    const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings({ ...settings, rateSettings: { ...rateSettings, [name]: value } });
    };

    const handleCbmRateChange = (moveType: 'local' | 'gcc' | 'international', value: string) => {
        setSettings({
            ...settings,
            rateSettings: {
                ...rateSettings,
                cbmRates: { ...rateSettings.cbmRates, [moveType]: parseFloat(value) || 0 }
            }
        });
    };

    return (
        <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Local CBM Rate</Label>
                    <Input type="number" value={rateSettings.cbmRates.local} onChange={(e) => handleCbmRateChange('local', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>GCC CBM Rate</Label>
                    <Input type="number" value={rateSettings.cbmRates.gcc} onChange={(e) => handleCbmRateChange('gcc', e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label>Int'l CBM Rate</Label>
                    <Input type="number" value={rateSettings.cbmRates.international} onChange={(e) => handleCbmRateChange('international', e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label>Minimum Charge</Label>
                    <Input name="minCharge" type="number" value={rateSettings.minCharge} onChange={handleRateChange} />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Labor Cost</Label>
                    <Input name="labor" type="number" value={rateSettings.labor} onChange={handleRateChange} />
                </div>
                 <div className="space-y-2">
                    <Label>Surcharges</Label>
                    <Input name="surcharges" type="number" value={rateSettings.surcharges} onChange={handleRateChange} />
                </div>
            </div>
             <div className="grid grid-cols-3 gap-4">
                 <div className="space-y-2">
                    <Label>VAT %</Label>
                    <Input name="vat" type="number" value={rateSettings.vat} onChange={handleRateChange} />
                </div>
                <div className="space-y-2">
                    <Label>Insurance %</Label>
                    <Input name="insurance" type="number" value={rateSettings.insurance} onChange={handleRateChange} />
                </div>
                 <div className="space-y-2">
                    <Label>Markup %</Label>
                    <Input name="markup" type="number" value={rateSettings.markup} onChange={handleRateChange} />
                </div>
            </div>
        </div>
    );
};

const DataTab = () => {
  const { settings, setSettings } = useSettings();
  const { toast } = useToast();

  const handleExport = () => {
    exportJson(settings, 'qgo-cargo-settings');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const importedSettings = await importJson(file);
        // Basic validation can be added here
        setSettings(importedSettings);
        toast({ title: 'Success', description: 'Settings imported successfully.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Import Failed', description: 'The selected file is not valid JSON.' });
      }
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
      setSettings(DEFAULT_EDITOR_SETTINGS);
      toast({ title: 'Settings Reset', description: 'All settings have been restored to their default values.' });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Export your current settings or import a previously saved configuration file.</p>
      <div className="flex gap-2">
        <Button onClick={handleExport}>Export Settings</Button>
        <Button variant="outline" asChild>
          <label htmlFor="import-settings">
            Import Settings
            <input type="file" id="import-settings" accept=".json" className="sr-only" onChange={handleImport} />
          </label>
        </Button>
      </div>
       <div className="border-t pt-4 mt-4">
           <Button variant="destructive" onClick={handleReset}>Reset All Settings</Button>
      </div>
    </div>
  );
};


export default function EditorPanel() {
  const { isUnlocked, setUnlocked } = useEditor();
  const { activeTab, setActiveTab } = useEditor();
  const tabs = [
    { id: 'surveys', label: 'Saved Surveys' },
    { id: 'company', label: 'Company' },
    { id: 'presets', label: 'Item Presets' },
    { id: 'rates', label: 'Rates' },
    { id: 'data', label: 'Data Mgmt' },
  ];

  return (
    <Sheet open={isUnlocked} onOpenChange={setUnlocked}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Editor Mode</SheetTitle>
          <SheetDescription>
            Modify application settings and manage surveys here. Changes are saved automatically.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-5">
              {tabs.map(tab => (
                 <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            <ScrollArea className="flex-1">
                <div className="py-4 px-1">
                    <TabsContent value="surveys"><SavedSurveysTab /></TabsContent>
                    <TabsContent value="company"><CompanyInfoTab /></TabsContent>
                    <TabsContent value="presets"><ItemPresetsTab /></TabsContent>
                    <TabsContent value="rates"><RatesTab /></TabsContent>
                    <TabsContent value="data"><DataTab /></TabsContent>
                </div>
            </ScrollArea>
          </Tabs>
        </div>
        <SheetFooter>
          <Button onClick={() => setUnlocked(false)}>Close Editor</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
