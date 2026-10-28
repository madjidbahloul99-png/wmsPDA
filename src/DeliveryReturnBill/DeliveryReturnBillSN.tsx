import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import { useGlobalStr } from '../../GlobalStrContext';
import * as pubfunction from '../pubfunction';
import { ApiContext, checkSNTraceability } from './api';
import { ReturnContext, TraceabilityRecord } from './types';
import { EVENT_RETURNED } from './events';

/**
 * Page 2 - Scan the SN of the returned product and check its delivery traceability.
 *
 *   traceability found  -> the confirm page
 *   no delivery found   -> the EAN page (the EAN has to be scanned)
 *
 * The list of the scanned items is kept in the screen on purpose: the real API
 * has no endpoint that returns it. Every successful return appends the scanned
 * SN to the table below, the quantities come from the answer of the save.
 */
export default function DeliveryReturnBillSN({ navigation, route }: any) {
  const params: ReturnContext = useMemo(
    () => route.params || {},
    [route.params],
  );

  const {
    gs_deliveryReturnAPI,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
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
  const [txtSN, setTxtSN] = useState('');
  const [labelError, setLabelError] = useState('');
  const [labelStatus, setLabelStatus] = useState('');
  const [doneQty, setDoneQty] = useState<number>(0);
  const [planQty, setPlanQty] = useState<number>(0);
  const [products, setProducts] = useState<TraceabilityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);
  // True while a request is in flight, a ref is always up to date (no stale closure)
  const busyRef = useRef(false);
  // The scanned items, kept in a ref to always be up to date
  const productsRef = useRef<TraceabilityRecord[]>([]);

  // Keep the quantities of the selected model
  useEffect(() => {
    setPlanQty(params.f_planQty || 0);
    setDoneQty(params.f_doneQty || 0);
  }, [params.f_planQty, params.f_doneQty]);
  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  /**
   * Scans back to this page: refresh the quantities and remember the returned
   * product (the API has no endpoint for the scanned list).
   */
  useEffect(() => {
    const returnedSub = DeviceEventEmitter.addListener(
      EVENT_RETURNED,
      (data?: {
        actualQty?: number;
        planQty?: number;
        productStatus?: string;
        sn?: string;
        model?: string;
        outBillCode?: string;
        sapMainBillCode?: string;
        billFinished?: boolean;
      }) => {
        if (data) {
          if (typeof data.actualQty === 'number') setDoneQty(data.actualQty);
          if (typeof data.planQty === 'number') setPlanQty(data.planQty);
          if (data.billFinished) {
            setLabelStatus('This return bill is finished.');
          } else if (data.productStatus) {
            setLabelStatus(`Status: ${data.productStatus}`);
          }
          if (
            data.sn &&
            !productsRef.current.some(product => product.sn === data.sn)
          ) {
            const product: TraceabilityRecord = {
              sn: data.sn,
              model: data.model || params.f_model || '',
              outBillCode: data.outBillCode || '',
              sapMainBillCode: data.sapMainBillCode || params.f_billCode || '',
            } as TraceabilityRecord;
            const list = [...productsRef.current, product];
            productsRef.current = list;
            setProducts(list);
          }
        }
        setTxtSN('');
        setLabelError('');
        setTimeout(() => {
          txtSNRef.current?.focus();
        }, 150);
      },
    );

    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    return () => {
      returnedSub.remove();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, [params.f_billCode, params.f_model]);

  const buildContext = useCallback(
    (): ReturnContext => ({
      ...params,
      f_planQty: planQty,
      f_doneQty: doneQty,
      f_diffQty: planQty - doneQty,
    }),
    [params, planQty, doneQty],
  );

  /**
   * Scanned SN handling, checks the delivery traceability.
   */
  const processSNInput = async (scannedText: string) => {
    // A scan during a request is ignored, it would navigate twice
    if (busyRef.current) return;

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    const SN = (scannedText || '')
      .replace(/[\r\n]/g, '')
      .trim()
      .toUpperCase();
    if (!SN) return;

    setTxtSN('');
    setLabelError('');

    // The EAN is scanned on its own page, refuse it here
    if (SN.substring(0, 3) === '613') {
      setLabelError(
        'Please scan the product SN, this is an EAN (starts with 613)!',
      );
      ensureFocus();
      return;
    }

    setLoading(true);
    busyRef.current = true;
    try {
      // The product is already in the list of the scanned items
      const scanned = productsRef.current.some(
        product => product.sn.toUpperCase() === SN,
      );
      if (scanned) {
        setLabelError('This product was already scanned.');
        pubfunction.ShowError('This product was already scanned.');
        return;
      }

      const result = await checkSNTraceability(apiCtx, {
        sn: SN,
        mainBillCode: params.f_billCode || '',
        model: params.f_model || '',
      });
      console.info(
        '[DeliveryReturnBillSN] checkSNTraceability result:',
        result,
      );

      if (result.found && result.traces.length > 0) {
        // Traceability found, straight to the confirmation
        navigation.navigate('DeliveryReturnBillConfirm', {
          ...buildContext(),
          f_sn: SN,
          f_traces: result.traces,
        });
        return;
      }

      // The product was not found, the EAN identifies it
      const message =
        result.error || `SN ${SN} not found, please scan the EAN.`;
      if (result.requiresEan) {
        navigation.navigate('DeliveryReturnBillEAN', {
          ...buildContext(),
          f_sn: SN,
          f_requiresEan: true,
          f_initialMessage: message,
        });
      } else {
        setLabelError(message);
      }
    } catch (err: any) {
      const message = err.message || 'Network error';
      navigation.navigate('DeliveryReturnBillEAN', {
        ...buildContext(),
        f_sn: SN,
        f_requiresEan: true,
        f_initialMessage: message,
      });
    } finally {
      busyRef.current = false;
      setLoading(false);
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    }
  };

  const handleTextChange = (text: string) => {
    setTxtSN(text);
    setLabelError('');

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    if (text.includes('\n') || text.includes('\r')) {
      const clean = text.replace(/[\r\n]/g, '').trim();
      if (clean.length > 0) {
        processSNInput(clean);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Auto trigger once the scanner is done
    scanTimer.current = setTimeout(() => {
      if (trimmed.length > 0) {
        processSNInput(trimmed);
      }
    }, 600);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  /**
   * One item of the scanned list, everything was returned successfully so the
   * rows are all in the ink color.
   */
  const renderProduct = ({
    item,
    index,
  }: {
    item: TraceabilityRecord;
    index: number;
  }) => {
    return (
      <View
        style={[
          styles.tableRow,
          { backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC' },
        ]}
      >
        <Text style={[styles.cell, { width: 150 }]}>{item.sn}</Text>
        <Text style={[styles.cell, { width: 130 }]}>{item.model || '-'}</Text>
        <Text style={[styles.cell, { width: 130 }]}>
          {item.outBillCode || '-'}
        </Text>
        <Text style={[styles.cell, { width: 130 }]}>
          {item.sapMainBillCode || '-'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
            <Image
              source={require('../../assets/logo/left.png')}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Delivery Return SN {gs_wareCode || ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Information of the selected model */}
        <View style={styles.infoCardWrapper}>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Source</Text>
            <Text style={styles.infoValueWhite}>
              {params.f_customerCode || '-'}#
              {params.f_wareCode || gs_wareCode || '-'}
            </Text>
          </View>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Qty</Text>
            <Text style={styles.infoValueWhite}>
              {doneQty}/{planQty}
            </Text>
          </View>
          <View style={[styles.infoRowItem, { marginBottom: 0 }]}>
            <Text style={styles.infoLabelWhite}>Model</Text>
            <Text style={styles.infoValueWhite}>{params.f_model || '-'}</Text>
          </View>
        </View>

        {labelStatus ? (
          <Text style={styles.statusText}>{labelStatus}</Text>
        ) : null}

        {/* SN input */}
        <View style={styles.inputGroup}>
          <TextInput
            ref={txtSNRef}
            style={styles.input}
            value={txtSN}
            onChangeText={handleTextChange}
            editable={!loading}
            placeholder=" SCAN PRODUCT SN"
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
        </View>

        {/* Products that were already scanned in this session */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>
                  Out Bill
                </Text>
                <Text style={[styles.headerCell, { width: 130 }]}>
                  SAP Bill
                </Text>
              </View>

              <FlatList
                data={products}
                renderItem={renderProduct}
                keyExtractor={(item, index) => `${item.sn}-${index}`}
                ListEmptyComponent={
                  <View style={styles.tableRow}>
                    <Text style={[styles.cell, { width: 540 }]}>
                      No product scanned yet
                    </Text>
                  </View>
                }
                style={{ flex: 1 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
              />
            </View>
          </ScrollView>

          <View style={styles.totalRow}>
            <Text style={styles.totalText}>{`Total: ${products.length}`}</Text>
          </View>
        </View>
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
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabelWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  infoValueWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  statusText: {
    color: '#0052cc',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    marginLeft: 4,
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
  tableCard: {
    flex: 1,
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
  totalRow: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'flex-end',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0052cc',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
