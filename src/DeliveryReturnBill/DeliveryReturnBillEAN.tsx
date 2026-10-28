import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import { useGlobalStr } from '../../GlobalStrContext';
import * as pubfunction from '../pubfunction';
import { ApiContext, lookupByEAN, submitReturnWithEAN } from './api';
import { EANCandidate, ReturnContext } from './types';
import { EVENT_RETURNED } from './events';

/**
 * Page 3 - Scan the EAN of a product that has no delivery traceability.
 *
 * The EAN is matched to a model: the lookup returns the list of the models
 * that carry it, the operator selects the model of the product he wants to
 * return and presses Confirm OK. The return is saved with scanType = "EAN"
 * and the screen goes back to the SN scan page.
 */
export default function DeliveryReturnBillEAN({ navigation, route }: any) {
  const params: ReturnContext & {
    f_sn?: string;
    f_requiresEan?: boolean;
    f_initialMessage?: string;
  } = useMemo(() => route.params || {}, [route.params]);

  const {
    gs_deliveryReturnAPI,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
    gs_remark,
  } = useGlobalStr();

  const apiCtx: ApiContext = useMemo(
    () => ({
      gs_deliveryReturnAPI,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    }),
    [
      gs_deliveryReturnAPI,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    ],
  );

  // Screen states
  const [txtEAN, setTxtEAN] = useState('');
  const [labelError, setLabelError] = useState(params.f_initialMessage || '');
  const [labelInfo, setLabelInfo] = useState('');
  const [scannedEAN, setScannedEAN] = useState('');
  const [candidates, setCandidates] = useState<EANCandidate[]>([]);
  // The identity of the selected row (model | color | ean), two models of the
  // same list can share a model code but differ by their color
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard] = useState(false);

  const txtEANRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);
  // True while a request is in flight, a ref is always up to date (no stale closure)
  const busyRef = useRef(false);

  const ensureFocus = () => {
    txtEANRef.current?.focus();
  };

  useEffect(() => {
    // The EAN page only makes sense after a failed traceability check
    if (!params.f_requiresEan) {
      navigation.goBack();
      return;
    }

    setTimeout(() => {
      txtEANRef.current?.focus();
    }, 300);

    return () => {
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, [params.f_requiresEan, navigation]);

  /**
   * The return is saved for the model the operator selected.
   */
  const submitReturn = async (
    model: EANCandidate,
    eanToSubmit: string = scannedEAN,
  ) => {
    setLoading(true);
    busyRef.current = true;
    try {
      const result = await submitReturnWithEAN(apiCtx, {
        context: params,
        sn: params.f_sn || '',
        ean: eanToSubmit,
        model: model.model,
      });

      DeviceEventEmitter.emit(EVENT_RETURNED, {
        actualQty: result.actualQty,
        planQty: result.planQty,
        productStatus: result.productStatus,
        billFinished: result.billFinished,
        sn: params.f_sn,
        model: model.model,
        sapMainBillCode: params.f_billCode,
      });

      // Back to the SN scan page for the next product
      navigation.goBack();
    } catch (err: any) {
      const message = err.message || 'Network error';
      pubfunction.ShowError(message);
      setLabelError(message);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  /**
   * Looks up the models of the scanned EAN, the list is the list of the
   * models of the API (model | description | color | ean).
   */
  const lookupEAN = async (EAN: string) => {
    setLoading(true);
    busyRef.current = true;
    try {
      const result = await lookupByEAN(apiCtx, {
        ean: EAN,
        mainBillCode: params.f_billCode || '',
      });

      if (result.candidates.length === 0) {
        setCandidates([]);
        setSelectedKey(null);
        setScannedEAN('');
        const message = result.message || `EAN ${EAN} not found.`;
        setLabelError(message);
        return;
      }

      setScannedEAN(EAN);
      setCandidates(result.candidates);
      setLabelError('');
      if (result.candidates.length === 1) {
        setSelectedKey(candidateKey(result.candidates[0]));
        setLabelInfo('');
        await submitReturn(result.candidates[0], EAN);
        return;
      }

      setSelectedKey(null);
      setLabelInfo(result.message || '');
    } catch (err: any) {
      pubfunction.ShowError(err.message || 'Network error');
      setLabelError(err.message || 'Network error');
    } finally {
      busyRef.current = false;
      setLoading(false);
      setTimeout(() => {
        txtEANRef.current?.focus();
      }, 150);
    }
  };

  /**
   * Validates the scanned EAN and looks it up.
   */
  const processEANInput = (scannedText: string) => {
    // A scan during a request is ignored, it would look up twice
    if (busyRef.current) return;

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    const EAN = (scannedText || '')
      .replace(/[\r\n]/g, '')
      .trim()
      .toUpperCase();
    if (!EAN) return;

    setTxtEAN('');
    setLabelError('');
    setLabelInfo('');

    // The permission check is disabled for the tests, to re-enable it add
    // gs_remark back to the useGlobalStr() destructure above.
    // if ((gs_remark || '').toUpperCase() !== 'EAN') {
    //   pubfunction.ShowError("You don't have permission to scan EAN!");
    //   setLabelError("You don't have permission to scan EAN!");
    //   return;
    // }

    lookupEAN(EAN);
  };

  const handleTextChange = (text: string) => {
    setTxtEAN(text);
    setLabelError('');
    setLabelInfo('');

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    if (text.includes('\n') || text.includes('\r')) {
      const clean = text.replace(/[\r\n]/g, '').trim();
      if (clean.length > 0) {
        processEANInput(clean);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Auto trigger once the scanner is done
    scanTimer.current = setTimeout(() => {
      if (trimmed.length > 0) {
        processEANInput(trimmed);
      }
    }, 600);
  };

  /**
   * The identity of a candidate row: two models of the list can share a model
   * code (the API answers one row per model and color).
   */
  const candidateKey = (model: EANCandidate): string =>
    `${model.model}|${model.colorName}|${model.ean}`;

  const handleConfirmClick = () => {
    // A double tap would save the return twice
    if (busyRef.current) return;

    const model = candidates.find(item => candidateKey(item) === selectedKey);
    if (!model) {
      pubfunction.ShowError('Please select a model first!');
      return;
    }
    submitReturn(model);
  };

  const renderCandidate = ({
    item,
    index,
  }: {
    item: EANCandidate;
    index: number;
  }) => {
    const isSelected = selectedKey === candidateKey(item);
    return (
      <TouchableOpacity
        style={[
          styles.tableRow,
          { backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC' },
          isSelected && styles.selectedRow,
        ]}
        onPress={() => setSelectedKey(candidateKey(item))}
        activeOpacity={0.7}
      >
        <Text style={[styles.cell, { width: 140 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 240 }]}>
          {item.modelDesc || '-'}
        </Text>
        <Text style={[styles.cell, { width: 110 }]}>
          {item.colorName || '-'}
        </Text>
        <Text style={[styles.cell, { width: 150 }]}>{item.ean}</Text>
      </TouchableOpacity>
    );
  };

  const infoRow = (label: string, value: string) => (
    <View style={styles.infoRowItem}>
      <Text style={styles.infoLabelWhite}>{label}</Text>
      <Text style={styles.infoValueWhite}>{value || '-'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Image
              source={require('../../assets/logo/left.png')}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Return EAN</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContentInner}
        >
          {/* Product being processed */}
          <View style={styles.infoCardWrapper}>
            {infoRow('SN', params.f_sn || '-')}
            {infoRow('Model', params.f_model)}
            {infoRow('Description', params.f_modelDesc)}
            {infoRow('Delivery bill', params.f_systemDeliveryCode)}
            {infoRow('EAN', scannedEAN)}
            {infoRow(
              'Customer',
              `${params.f_customerCode || '-'} ${params.f_customerName || ''}`,
            )}
          </View>

          {/* EAN input */}
          <View style={styles.inputGroup}>
            <TextInput
              ref={txtEANRef}
              style={styles.input}
              value={txtEAN}
              onChangeText={handleTextChange}
              editable={!loading}
              placeholder=" SCAN EAN"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              autoCorrect={false}
              showSoftInputOnFocus={showKeyboard}
              blurOnSubmit={false}
              onBlur={ensureFocus}
              selectTextOnFocus={true}
            />
            {labelError ? (
              <Text style={styles.infoText}>{labelError}</Text>
            ) : null}
            {labelInfo ? (
              <Text style={styles.statusText}>{labelInfo}</Text>
            ) : null}
          </View>

          {/* The models that carry the scanned EAN, the operator picks one */}
          {candidates.length > 1 ? (
            <View style={styles.tableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.headerCell, { width: 140 }]}>
                      MODEL
                    </Text>
                    <Text style={[styles.headerCell, { width: 240 }]}>
                      Description
                    </Text>
                    <Text style={[styles.headerCell, { width: 110 }]}>
                      Color
                    </Text>
                    <Text style={[styles.headerCell, { width: 150 }]}>EAN</Text>
                  </View>

                  <FlatList
                    data={candidates}
                    renderItem={renderCandidate}
                    keyExtractor={(item, index) => `${item.model}-${index}`}
                    style={{ flex: 1 }}
                    initialNumToRender={10}
                  />
                </View>
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer, the confirm appears when there is a list to choose from */}
        {candidates.length > 1 ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnConfirm,
                (loading || !selectedKey) && styles.btnDisabled,
              ]}
              onPress={handleConfirmClick}
              disabled={loading || !selectedKey}
            >
              <Text style={styles.btnText}>
                {loading ? 'Saving...' : 'Confirm OK'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0052cc" />
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0052cc',
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  returnLogo: {
    width: scale(24),
    height: scale(24),
    marginRight: 10,
    tintColor: '#FFFFFF',
  },
  headerTitle: { color: '#FFFFFF', fontSize: scale(14), fontWeight: '900' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  userNameText: { color: '#FFFFFF', fontSize: scale(12), fontWeight: '700' },
  content: { flex: 1, padding: 8 },
  scrollContent: { flex: 1 },
  scrollContentInner: { paddingBottom: 8 },
  infoCardWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0052cc',
    marginBottom: 8,
  },
  infoRowItem: {
    backgroundColor: '#0052cc',
    padding: 9,
    borderRadius: 8,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabelWhite: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  infoValueWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    flexShrink: 1,
  },
  inputGroup: { marginBottom: 12 },
  input: {
    backgroundColor: '#e2f0eeff',
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#0052cc',
  },
  infoText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '800',
  },
  statusText: {
    color: '#0052cc',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    marginLeft: 4,
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0052cc',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0052cc',
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  cell: {
    fontSize: 11,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectedRow: { backgroundColor: '#BAE6FD' },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
  },
  btnConfirm: { backgroundColor: '#10B981' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
