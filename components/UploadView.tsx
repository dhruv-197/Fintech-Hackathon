import React, { useState, useCallback } from 'react';
import { GLAccount, UserRole, ReviewStatus, AuditLogEntry, UploadError } from '../types';
import { UploadCloud, FileCheck2, FileX2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadViewProps {
    onAddAccounts: (newAccounts: GLAccount[]) => void;
    currentAccounts: GLAccount[];
}

// Maps file headers to internal data model keys
const headerMapping: { [key: string]: keyof GLAccount } = {
    'BS/PL': 'bsPl',
    'Status': 'statusCategory',
    'G/L Acct': 'glAccount',
    'G/L Account Number': 'glAccountNumber',
    'Main Head': 'mainHead',
    'Sub head': 'subHead',
    'Responsible Department': 'responsibleDept',
    'Departement SPOC': 'spoc',
    'Departement Reviewer': 'reviewer',
};

// These are the user-facing headers that MUST exist in the uploaded file.
const requiredFileHeaders = ['G/L Account Number', 'G/L Acct', 'Responsible Department'];

const UploadView: React.FC<UploadViewProps> = ({ onAddAccounts, currentAccounts }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errors, setErrors] = useState<UploadError[]>([]);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const processFileData = (jsonData: any[], originalFileName: string) => {
        const newAccounts: GLAccount[] = [];
        const newErrors: UploadError[] = [];
        
        if (jsonData.length === 0) {
            newErrors.push({ row: 1, message: 'The file is empty or could not be read.', data: originalFileName });
            setErrors(newErrors);
            setIsProcessing(false);
            return;
        }

        const fileHeaders = Object.keys(jsonData[0]).map(h => h.trim());
        const missingHeaders = requiredFileHeaders.filter(h => !fileHeaders.includes(h));

        if (missingHeaders.length > 0) {
             newErrors.push({ row: 1, message: `File is missing required headers: ${missingHeaders.join(', ')}`, data: fileHeaders.join(', ') });
             setErrors(newErrors);
             setIsProcessing(false);
             return;
        }
        
        // --- Duplicate Check Logic ---
        const seenAccountNumbers = new Map<string, number[]>(); // Map GL Account Number to an array of row numbers
        jsonData.forEach((row, index) => {
            const rowNum = index + 2; // Excel row number (header is 1, data starts at 2)
            const accountNumber = row['G/L Account Number'] ? String(row['G/L Account Number']).trim() : '';
            if (accountNumber) {
                if (!seenAccountNumbers.has(accountNumber)) {
                    seenAccountNumbers.set(accountNumber, []);
                }
                seenAccountNumbers.get(accountNumber)!.push(rowNum);
            }
        });

        const duplicateRows = new Set<number>();
        seenAccountNumbers.forEach((rows, accountNumber) => {
            if (rows.length > 1) {
                newErrors.push({
                    row: rows[0], // Report error against the first occurrence
                    message: `Duplicate G/L Account Number '${accountNumber}' found on rows: ${rows.join(', ')}. These rows were not imported.`,
                    data: `Account: ${accountNumber}`
                });
                rows.forEach(rowNum => duplicateRows.add(rowNum));
            }
        });
        // --- End of Duplicate Check Logic ---

        const lastId = Math.max(...currentAccounts.map(a => a.id), 0);
        
        jsonData.forEach((row, index) => {
            const rowNum = index + 2; // +1 for header, +1 for 0-index

            if (duplicateRows.has(rowNum)) {
                return;
            }

            const mappedRow: Partial<GLAccount> = {};
            for (const fileHeader in headerMapping) {
                if (row[fileHeader] !== undefined) {
                    const internalKey = headerMapping[fileHeader] as keyof GLAccount;
                    (mappedRow as any)[internalKey] = row[fileHeader];
                }
            }

            if (!mappedRow.glAccountNumber || !mappedRow.glAccount || !mappedRow.responsibleDept) {
                newErrors.push({ row: rowNum, message: 'Missing values in required columns (G/L Account Number, G/L Acct, Responsible Department).', data: JSON.stringify(row) });
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
        if (newAccounts.length > 0) {
            onAddAccounts(newAccounts);
        }
        setIsProcessing(false);
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        setFileName(file.name);
        setErrors([]);
        setSuccessCount(null);
        
        const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
        const isCsv = file.name.toLowerCase().endsWith('.csv');

        if (!isXlsx && !isCsv) {
            setErrors([{
                row: 0, // Signifies a pre-processing error
                message: `Invalid file type. Please upload a .xlsx or .csv file.`,
                data: file.name
            }]);
            setIsProcessing(false);
            setFileName(null);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileData = e.target?.result;
            if (!fileData) {
                setErrors([{ row: 1, message: 'Could not read the file.', data: file.name }]);
                setIsProcessing(false);
                return;
            }

            try {
                let jsonData: any[] = [];
                const workbook = XLSX.read(fileData, { type: isXlsx ? 'array' : 'string' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                jsonData = XLSX.utils.sheet_to_json(worksheet);
                processFileData(jsonData, file.name);
            } catch (error) {
                console.error("File processing error:", error);
                setErrors([{row: 1, message: "Failed to parse the file. It might be corrupted or in an unexpected format.", data: file.name}]);
                setIsProcessing(false);
            }
        };
        
        reader.onerror = () => {
             setErrors([{row: 1, message: "Failed to read the file.", data: file.name}]);
             setIsProcessing(false);
        }

        if (isXlsx) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) processFile(file);
        event.target.value = ''; // Reset file input
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    }, []);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Data Ingestion</h2>
                <p className="text-gray-600 mb-6">Upload an XLSX or CSV file with your trial balance data to begin the assurance process.</p>
                
                <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
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
                    
                    {isProcessing && <p className="mt-4 text-sm text-blue-600">Processing...</p>}
                    
                    {fileName && !isProcessing && (
                         <div className="mt-4 text-sm text-gray-600">File: {fileName}</div>
                    )}
                </div>

                {(errors.length > 0 || successCount !== null) && (
                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-700">Processing Results</h3>
                     {successCount !== null && successCount > 0 && (
                          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                             <FileCheck2 className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                             <p className="text-sm text-green-800">Successfully ingested <span className="font-bold">{successCount}</span> valid records. You can now review them on the dashboard.</p>
                         </div>
                     )}
                     {errors.length > 0 && (
                         <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start">
                                <FileX2 className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-red-800">{errors.length === 1 && errors[0].row === 0 ? 'Upload Error' : `${errors.length} validation ${errors.length === 1 ? 'error was' : 'errors were'} found.`}</h4>
                                    <ul className="mt-2 list-disc list-inside text-sm text-red-700 space-y-1">
                                       {errors.map((err, i) => (
                                           <li key={i}>
                                               {err.row > 0 && <span className="font-mono">Row {err.row}:</span>} {err.message}
                                           </li>
                                       ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                     )}
                </div>
                )}
            </div>
        </div>
    );
};

export default UploadView;