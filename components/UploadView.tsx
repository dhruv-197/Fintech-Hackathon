import React, { useState, useCallback } from 'react';
import { GLAccount, UserRole, ReviewStatus, AuditLogEntry, UploadError } from '../types';
import { UploadCloud, FileCheck2, FileX2, Database, Briefcase, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadViewProps {
    onAddAccounts: (newAccounts: GLAccount[]) => void;
    currentAccounts: GLAccount[];
}

const headerMapping: { [key in keyof Partial<GLAccount>]: string[] } = {
    bsPl: ['BS/PL'],
    statusCategory: ['Status'],
    glAccount: ['G/L Acct', 'GL Acct', 'GL Account'],
    glAccountNumber: ['G/L Account Number', 'GL Account Number', 'GL Account No.', 'G/L Acct No.'],
    mainHead: ['Main Head'],
    subHead: ['Sub head', 'Sub Head'],
    responsibleDept: ['Responsible Department', 'Department', 'Dept', 'Dept Responsible'],
    spoc: ['Departement SPOC', 'SPOC'],
    reviewer: ['Departement Reviewer', 'Reviewer'],
};

const requiredInternalKeys: (keyof GLAccount)[] = ['glAccountNumber', 'glAccount', 'responsibleDept'];

type Tab = 'file' | 'db' | 'sap';
type UploadStep = 'select' | 'preview' | 'complete';

interface PreviewData {
    sheetName: string;
    headers: string[];
    mappedHeaders: Map<string, keyof GLAccount>;
    sampleRows: any[];
    fullData: any[];
    originalFileName: string;
}

const UploadView: React.FC<UploadViewProps> = ({ onAddAccounts, currentAccounts }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errors, setErrors] = useState<UploadError[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('file');
    const [uploadStep, setUploadStep] = useState<UploadStep>('select');
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);

    const resetState = () => {
        setFileName(null);
        setIsProcessing(false);
        setErrors([]);
        setWarnings([]);
        setSuccessCount(null);
        setUploadStep('select');
        setPreviewData(null);
    };
    
    const findBestSheetAndHeaders = (workbook: XLSX.WorkBook) => {
        let bestCandidate: { sheetName: string; worksheet: XLSX.WorkSheet; headerRowIndex: number; headers: string[], score: number } | null = null;
    
        const allAliases = new Set<string>();
        Object.values(headerMapping).forEach(aliases => aliases.forEach(a => allAliases.add(a.toLowerCase())));
    
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const row = rows[i];
                if (!row || row.every(cell => String(cell).trim() === '')) continue;
    
                let score = 0;
                let validHeaders = 0;
                for (const cell of row) {
                    if (typeof cell === 'string' && allAliases.has(cell.trim().toLowerCase())) {
                        score++;
                    }
                     if (cell && String(cell).trim() !== '' && !String(cell).startsWith('__EMPTY')) {
                        validHeaders++;
                    }
                }
    
                const requiredMatches = requiredInternalKeys.filter(key => 
                    headerMapping[key]!.some(alias => row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === alias.toLowerCase()))
                ).length;

                if (requiredMatches === requiredInternalKeys.length && score / validHeaders > 0.5) {
                    const currentPriority = sheetName.toLowerCase().includes('summary') ? 0 : 1;
                    const bestPriority = bestCandidate ? (bestCandidate.sheetName.toLowerCase().includes('summary') ? 0 : 1) : -1;
    
                    if (!bestCandidate || score > bestCandidate.score || (score === bestCandidate.score && currentPriority > bestPriority)) {
                        bestCandidate = {
                            sheetName,
                            worksheet,
                            headerRowIndex: i,
                            headers: row.map(h => String(h)),
                            score,
                        };
                    }
                }
            }
        }
        return bestCandidate;
    };

    const confirmAndIngest = () => {
        if (!previewData) return;
        setIsProcessing(true);

        const { fullData, mappedHeaders } = previewData;
        const newAccounts: GLAccount[] = [];
        const newErrors: UploadError[] = [];
        
        const glAccountNumberInternalKey = 'glAccountNumber';
        const glAccountNumberHeader = [...mappedHeaders.entries()].find(([_, val]) => val === glAccountNumberInternalKey)?.[0];

        const seenAccountNumbers = new Map<string, number[]>();
        if (glAccountNumberHeader) {
            fullData.forEach((row, index) => {
                const rowNum = index + 2 + (previewData.sampleRows.length > 0 ? previewData.sampleRows[0].__rowNum__ - 2 : 0);
                const accountNumber = row[glAccountNumberHeader] ? String(row[glAccountNumberHeader]).trim() : '';
                if (accountNumber) {
                    if (!seenAccountNumbers.has(accountNumber)) seenAccountNumbers.set(accountNumber, []);
                    seenAccountNumbers.get(accountNumber)!.push(rowNum);
                }
            });
        }
        
        const duplicateRows = new Set<number>();
        seenAccountNumbers.forEach((rows, accountNumber) => {
            if (rows.length > 1) {
                newErrors.push({
                    row: rows[0],
                    message: `Duplicate G/L Account Number '${accountNumber}' found on rows: ${rows.join(', ')}. These rows were not imported.`,
                    data: `Account: ${accountNumber}`
                });
                rows.forEach(rowNum => duplicateRows.add(rowNum));
            }
        });

        const lastId = Math.max(...currentAccounts.map(a => a.id), 0);
        
        fullData.forEach((row, index) => {
            const rowNum = index + 2 + (previewData.sampleRows.length > 0 ? previewData.sampleRows[0].__rowNum__ - 2 : 0);
            if (duplicateRows.has(rowNum)) return;

            const mappedRow: Partial<GLAccount> = {};
            for (const fileHeader in row) {
                const internalKey = mappedHeaders.get(fileHeader.trim());
                if (internalKey) {
                    (mappedRow as any)[internalKey] = row[fileHeader];
                }
            }

            if (!mappedRow.glAccountNumber || !mappedRow.glAccount || !mappedRow.responsibleDept) {
                newErrors.push({ row: rowNum, message: 'Missing values in required columns.', data: JSON.stringify(row) });
                return;
            }

            const initialAuditLog: AuditLogEntry = {
                timestamp: new Date().toISOString(),
                user: 'System',
                role: UserRole.Admin,
                action: 'Data Ingestion',
                from: 'N/A',
                to: UserRole.Checker1,
            };

            const statusCategory = String(mappedRow.statusCategory || 'Assets') as 'Assets' | 'Liabilities' | 'Equity';
            if (!['Assets', 'Liabilities', 'Equity'].includes(statusCategory)) {
                mappedRow.statusCategory = 'Assets';
            }

            newAccounts.push({
                id: lastId + newAccounts.length + 1,
                bsPl: mappedRow.bsPl || 'BS',
                statusCategory: mappedRow.statusCategory,
                glAccount: String(mappedRow.glAccount),
                glAccountNumber: String(mappedRow.glAccountNumber),
                mainHead: mappedRow.mainHead || 'N/A',
                subHead: mappedRow.subHead || 'N/A',
                responsibleDept: String(mappedRow.responsibleDept),
                spoc: mappedRow.spoc || 'Unassigned',
                reviewer: mappedRow.reviewer || 'Unassigned',
                reviewStatus: ReviewStatus.Pending,
                currentChecker: UserRole.Checker1,
                auditLog: [initialAuditLog],
                mistakeCount: 0,
            });
        });
        
        setSuccessCount(newAccounts.length);
        setErrors(newErrors);
        setUploadStep('complete');
        setIsProcessing(false);
        if (newAccounts.length > 0) {
            onAddAccounts(newAccounts);
        }
    };
    
    const processFile = (file: File) => {
        resetState();
        setIsProcessing(true);
        setFileName(file.name);
        
        const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
        const isCsv = file.name.toLowerCase().endsWith('.csv');

        if (!isXlsx && !isCsv) {
            setErrors([{ row: 0, message: `Invalid file type. Please upload a .xlsx or .csv file.`, data: file.name }]);
            setIsProcessing(false);
            setFileName(null);
            setUploadStep('complete');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const fileData = e.target?.result;
                const workbook = XLSX.read(fileData, { type: 'array' });
                
                const bestSheetInfo = findBestSheetAndHeaders(workbook);

                if (!bestSheetInfo) {
                    setErrors([{ row: 1, message: "File does not contain the required headers ('G/L Account Number', 'G/L Acct', 'Responsible Department'). Please verify that the first non-empty row in your Excel file contains these headers." , data: file.name }]);
                    setIsProcessing(false);
                    setUploadStep('complete');
                    return;
                }

                if (workbook.SheetNames.length > 1) {
                    setWarnings([`File contains multiple sheets. The sheet '${bestSheetInfo.sheetName}' was automatically selected for import.`]);
                }
                
                const jsonData = XLSX.utils.sheet_to_json(bestSheetInfo.worksheet, { header: bestSheetInfo.headers, range: bestSheetInfo.headerRowIndex });

                const resolvedHeaderMap = new Map<string, keyof GLAccount>();
                bestSheetInfo.headers.forEach(originalHeader => {
                     const lowerHeader = originalHeader.trim().toLowerCase();
                     for (const key in headerMapping) {
                        const internalKey = key as keyof GLAccount;
                        if (headerMapping[internalKey]!.some(alias => alias.toLowerCase() === lowerHeader)) {
                            resolvedHeaderMap.set(originalHeader, internalKey);
                            break;
                        }
                    }
                });
                
                setPreviewData({
                    sheetName: bestSheetInfo.sheetName,
                    headers: bestSheetInfo.headers,
                    mappedHeaders: resolvedHeaderMap,
                    sampleRows: jsonData.slice(0, 5),
                    fullData: jsonData,
                    originalFileName: file.name,
                });
                setUploadStep('preview');
                setIsProcessing(false);
            } catch (error) {
                console.error("File processing error:", error);
                setErrors([{row: 1, message: `Failed to parse the file. It might be corrupted or in an unsupported format.`, data: file.name}]);
                setIsProcessing(false);
                setUploadStep('complete');
            }
        };
        reader.onerror = () => {
             setErrors([{row: 1, message: "Failed to read the file.", data: file.name}]);
             setIsProcessing(false);
             setUploadStep('complete');
        }
        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) processFile(file);
        event.target.value = '';
    };
    
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

    const handleDragEvents = (isOver: boolean) => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(isOver);
    };
    
    const TabButton: React.FC<{tab: Tab, children: React.ReactNode, icon: React.ReactNode}> = ({tab, children, icon}) => {
        const isActive = activeTab === tab;
        return (
            <button
                onClick={() => setActiveTab(tab)}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
                {icon}
                <span>{children}</span>
            </button>
        )
    }
    
    const UploadSelector = () => (
         <div 
            onDrop={handleDrop}
            onDragOver={handleDragEvents(true)}
            onDragEnter={handleDragEvents(true)}
            onDragLeave={handleDragEvents(false)}
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        >
            <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx" />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-sm text-gray-600">
                <label htmlFor="file-upload" className="font-semibold text-blue-600 cursor-pointer hover:underline">
                   Click to upload a file
                </label> or drag and drop it here.
            </p>
            <p className="text-xs text-gray-500 mt-1">XLSX or CSV files only</p>
            {isProcessing && <p className="mt-4 text-sm text-blue-600 animate-pulse">Analyzing file...</p>}
        </div>
    )

    const UploadPreview = () => {
        if (!previewData) return null;
        return (
            <div className="mt-6 border border-gray-200 rounded-lg">
                <div className="p-4 bg-gray-50 border-b">
                    <h3 className="text-lg font-semibold text-gray-700">Confirm Upload</h3>
                    <p className="text-sm text-gray-500">
                        Detected sheet "<span className="font-semibold">{previewData.sheetName}</span>" from file "<span className="font-semibold">{previewData.originalFileName}</span>". Please review the data below.
                    </p>
                </div>
                <div className="overflow-x-auto p-4">
                     <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                           <tr>
                                {previewData.headers.map((header, index) => {
                                    const mappedKey = previewData.mappedHeaders.get(header);
                                    const isRequired = mappedKey && requiredInternalKeys.includes(mappedKey);
                                    return (
                                        <th key={index} className="px-3 py-2 text-left font-medium text-gray-600">
                                            {header}
                                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                                        </th>
                                    )
                                })}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {previewData.sampleRows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {previewData.headers.map((header, colIndex) => (
                                        <td key={colIndex} className="px-3 py-2 whitespace-nowrap text-gray-700">{String(row[header] || '')}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                     </table>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
                    <button onClick={resetState} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-100">
                        Cancel
                    </button>
                    <button onClick={confirmAndIngest} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                        Confirm & Ingest Data
                    </button>
                </div>
            </div>
        )
    }

    const ProcessingResults = () => (
         <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700">Processing Results</h3>
             {successCount !== null && successCount > 0 && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                     <FileCheck2 className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                     <p className="text-sm text-green-800">Successfully ingested <span className="font-bold">{successCount}</span> valid records. You can now review them on the dashboard.</p>
                 </div>
             )}
             {warnings.length > 0 && (
                 <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
                     <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
                     <div>
                         <h4 className="font-semibold text-yellow-800">Please Note</h4>
                         <ul className="mt-2 list-disc list-inside text-sm text-yellow-700 space-y-1">
                             {warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                         </ul>
                     </div>
                 </div>
             )}
             {errors.length > 0 && (
                 <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <FileX2 className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold text-red-800">Upload Failed</h4>
                            <ul className="mt-2 list-disc list-inside text-sm text-red-700 space-y-1">
                               {errors.map((err, i) => (
                                   <li key={i}>
                                       {err.row > 1 && <span className="font-mono">Row {err.row}:</span>} {err.message}
                                   </li>
                               ))}
                            </ul>
                        </div>
                    </div>
                </div>
             )}
            <div className="mt-4">
                <button onClick={resetState} className="text-sm font-semibold text-blue-600 hover:underline">Upload another file</button>
            </div>
        </div>
    )

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Data Ingestion</h2>
                <p className="text-gray-600 mb-6">Start the process by uploading a file or connecting to a data source.</p>
                
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <TabButton tab="file" icon={<UploadCloud size={16}/>}>Upload File</TabButton>
                        <TabButton tab="db" icon={<Database size={16}/>}>Connect to Database</TabButton>
                        <TabButton tab="sap" icon={<Briefcase size={16}/>}>Connect to SAP</TabButton>
                    </nav>
                </div>

                {activeTab === 'file' && (
                    <>
                        {uploadStep === 'select' && <UploadSelector />}
                        {uploadStep === 'preview' && <UploadPreview />}
                        {uploadStep === 'complete' && <ProcessingResults />}
                    </>
                )}
                
                {activeTab !== 'file' && (
                    <div className="text-center p-10 bg-gray-50 rounded-lg border">
                        <h3 className="text-lg font-semibold text-gray-700">
                           {activeTab === 'db' ? 'Connect to Database' : 'Connect to SAP'}
                        </h3>
                        <p className="mt-2 text-gray-500">This feature is coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadView;